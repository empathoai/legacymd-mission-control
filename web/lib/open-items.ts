import "server-only"

import { supabase } from "@/lib/supabase/server"

export type OpenItem = {
  id: string
  saleId: string
  saleOccurredOn: string
  customerId: string
  customerName: string
  dueOn: string
  amount: number
  paid: number
  remaining: number
  overdue: boolean
  dueToday: boolean
}

export type MonthForecast = {
  month: string
  expected: number
  received: number
  overdue: number
}

type RawInstallment = {
  id: string
  sale_id: string
  due_on: string
  amount: number
  sales: { occurred_on: string; customer_id: string; customers: { id: string; full_name: string } | { id: string; full_name: string }[] | null } | Array<{ occurred_on: string; customer_id: string; customers: unknown }>
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Every installment that still expects money, with the patient and the sale. This is
 * the open ledger: what will come in, month by month, and what is already late.
 */
export async function listOpenItems(): Promise<OpenItem[]> {
  const [installments, receipts] = await Promise.all([
    supabase
      .from("sale_payments")
      .select(
        "id, sale_id, due_on, amount, sales ( occurred_on, customer_id, customers ( id, full_name ) )"
      )
      .eq("status", "pending")
      .order("due_on"),
    supabase.from("payment_receipts").select("sale_payment_id, amount"),
  ])

  if (installments.error) {
    throw new Error(`installments query failed: ${installments.error.message}`)
  }

  const paidBy = new Map<string, number>()
  for (const row of receipts.data ?? []) {
    const key = row.sale_payment_id as string
    paidBy.set(key, (paidBy.get(key) ?? 0) + Number(row.amount))
  }

  const today = new Date()
  const clinicDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today)

  const rows: OpenItem[] = []

  for (const raw of installments.data as unknown as RawInstallment[]) {
    const sale = one(raw.sales as never) as
      | { occurred_on: string; customer_id: string; customers: unknown }
      | null
    if (!sale) continue

    const customer = one(sale.customers as never) as
      | { id: string; full_name: string }
      | null

    const paid = paidBy.get(raw.id) ?? 0
    const remaining = Math.round((Number(raw.amount) - paid) * 100) / 100
    if (remaining <= 0) continue

    rows.push({
      id: raw.id,
      saleId: raw.sale_id,
      saleOccurredOn: sale.occurred_on,
      customerId: customer?.id ?? sale.customer_id,
      customerName: customer?.full_name ?? "(unknown)",
      dueOn: raw.due_on,
      amount: Number(raw.amount),
      paid,
      remaining,
      overdue: raw.due_on < clinicDay,
      dueToday: raw.due_on === clinicDay,
    })
  }

  return rows
}

export async function listForecast(): Promise<MonthForecast[]> {
  const [expected, collected] = await Promise.all([
    supabase.from("cash_expected").select("month, expected, overdue").order("month"),
    supabase.from("cash_collected").select("month, collected").order("month"),
  ])

  if (expected.error) throw new Error(`forecast query failed: ${expected.error.message}`)

  const receivedBy = new Map(
    (collected.data ?? []).map((row) => [row.month as string, Number(row.collected)])
  )

  const months = new Map<string, MonthForecast>()
  for (const row of expected.data ?? []) {
    months.set(row.month as string, {
      month: row.month as string,
      expected: Number(row.expected),
      received: receivedBy.get(row.month as string) ?? 0,
      overdue: Number(row.overdue),
    })
  }
  for (const row of collected.data ?? []) {
    const month = row.month as string
    if (!months.has(month)) {
      months.set(month, { month, expected: 0, received: Number(row.collected), overdue: 0 })
    }
  }

  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
}
