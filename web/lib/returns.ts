import "server-only"

import { supabase } from "@/lib/supabase/server"
import { clinicToday } from "@/lib/dates"

export type ReturnState = "pending" | "refunded"
export type ReturnKind = "refund" | "chargeback"

export type SaleDocument = {
  saleId: string
  occurredOn: string
  customerId: string
  customerName: string
  total: number
  collected: number
  returned: number
  remaining: number
}

export type ReturnRow = {
  id: string
  refundedOn: string
  state: ReturnState
  kind: ReturnKind
  amount: number
  reason: string
  methodLabel: string
  customerId: string | null
  customerName: string
}

export type VoidedSale = {
  saleId: string
  occurredOn: string
  total: number
  reason: string | null
  voidedBy: string | null
  customerId: string | null
  customerName: string
}

type Joined<T> = T | T[] | null

function one<T>(value: Joined<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

const LIMIT = 200

/**
 * The documents a section operates on. Without a search it is today's sales; with
 * one, it is every sale of that patient. No date pickers: the day or the patient.
 */
async function listSalesWithMoney(search?: string): Promise<SaleDocument[]> {
  const term = search?.trim() ? normalize(search.trim()) : null

  let query = supabase
    .from("sales")
    .select("id, occurred_on, voided_at, customers!inner ( id, full_name )")
    .order("occurred_on", { ascending: false })
    .limit(LIMIT)

  if (term) {
    query = query.ilike("customers.normalized_name", `%${term}%`)
  } else {
    query = query.eq("occurred_on", clinicToday())
  }

  const { data, error } = await query
  if (error) throw new Error(`sales query failed: ${error.message}`)

  const rows = data as unknown as Array<{
    id: string
    occurred_on: string
    voided_at: string | null
    customers: Joined<{ id: string; full_name: string }>
  }>

  if (rows.length === 0) return []

  const { data: money } = await supabase
    .from("sale_money")
    .select("sale_id, total, collected, returned, voided")
    .in("sale_id", rows.map((row) => row.id))

  const byId = new Map(
    (money ?? []).map((row) => [row.sale_id as string, row as {
      total: number
      collected: number
      returned: number
      voided: boolean
    }])
  )

  return rows
    .filter((row) => byId.has(row.id))
    .map((row) => {
      const moneyRow = byId.get(row.id)!
      const customer = one(row.customers)
      const collected = Number(moneyRow.collected)
      const returned = Number(moneyRow.returned)

      return {
        saleId: row.id,
        occurredOn: row.occurred_on,
        customerId: customer?.id ?? "",
        customerName: customer?.full_name ?? "(unknown)",
        total: Number(moneyRow.total),
        collected,
        returned,
        remaining: Math.round((collected - returned) * 100) / 100,
      }
    })
}

/** Sales that still have money to give back. */
export async function listReturnableSales(search?: string): Promise<SaleDocument[]> {
  const sales = await listSalesWithMoney(search)
  return sales.filter((sale) => sale.remaining > 0)
}

/** Sales with no money collected: the only ones a void is for. */
export async function listVoidableSales(search?: string): Promise<SaleDocument[]> {
  const sales = await listSalesWithMoney(search)
  return sales.filter((sale) => sale.collected === 0 && sale.returned === 0)
}

type RawReturn = {
  id: string
  amount: number
  refunded_on: string
  state: ReturnState
  kind: ReturnKind
  reason: string
  sale_id: string
  payment_methods: Joined<{ label: string }>
  sales: Joined<{
    occurred_on: string
    customer_id: string
    customers: Joined<{ full_name: string }>
  }>
}

export async function listRecordedReturns(limit = 20): Promise<ReturnRow[]> {
  const { data, error } = await supabase
    .from("sale_refunds")
    .select(
      "id, amount, refunded_on, state, kind, reason, sale_id, payment_methods ( label ), sales ( occurred_on, customer_id, customers ( full_name ) )"
    )
    .order("refunded_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`returns query failed: ${error.message}`)

  return (data as unknown as RawReturn[]).map((row) => {
    const sale = one(row.sales)
    const customer = sale ? one(sale.customers) : null
    return {
      id: row.id,
      refundedOn: row.refunded_on,
      state: row.state,
      kind: row.kind,
      amount: Number(row.amount),
      reason: row.reason,
      methodLabel: one(row.payment_methods)?.label ?? "—",
      customerId: sale?.customer_id ?? null,
      customerName: customer?.full_name ?? "(unknown)",
    }
  })
}

export async function listVoidedSales(limit = 20): Promise<VoidedSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, occurred_on, void_reason, voided_by, customers ( id, full_name )")
    .not("voided_at", "is", null)
    .order("occurred_on", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`voided sales query failed: ${error.message}`)

  const rows = data as unknown as Array<{
    id: string
    occurred_on: string
    void_reason: string | null
    voided_by: string | null
    customers: Joined<{ id: string; full_name: string }>
  }>

  const totals = new Map<string, number>()
  if (rows.length > 0) {
    const { data: money } = await supabase
      .from("sale_money")
      .select("sale_id, total")
      .in("sale_id", rows.map((row) => row.id))
    for (const row of money ?? []) {
      totals.set(row.sale_id as string, Number(row.total))
    }
  }

  return rows.map((row) => {
    const customer = one(row.customers)
    return {
      saleId: row.id,
      occurredOn: row.occurred_on,
      total: totals.get(row.id) ?? 0,
      reason: row.void_reason,
      voidedBy: row.voided_by,
      customerId: customer?.id ?? null,
      customerName: customer?.full_name ?? "(unknown)",
    }
  })
}
