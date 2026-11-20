import "server-only"

import { supabase } from "@/lib/supabase/server"
import { pageWindow } from "@/lib/pagination"

export type CustomerRow = {
  id: string
  fullName: string
  phone: string | null
  soldTotal: number
  spentTotal: number
  refundedTotal: number
  balance: number
  visits: number
  lastVisitOn: string | null
  nextDueOn: string | null
  isOverdue: boolean
  isSettled: boolean
}

export type CustomerPage = {
  rows: CustomerRow[]
  total: number
  page: number
  pageCount: number
}

const CUSTOMER_COLUMNS =
  "id, full_name, phone, sold_total, spent_total, refunded_total, balance, visits, last_visit_on, next_due_on, is_overdue, is_settled"

function toCustomerRow(row: Record<string, unknown>): CustomerRow {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    phone: row.phone as string | null,
    soldTotal: row.sold_total as number,
    spentTotal: row.spent_total as number,
    refundedTotal: row.refunded_total as number,
    balance: row.balance as number,
    visits: row.visits as number,
    lastVisitOn: row.last_visit_on as string | null,
    nextDueOn: row.next_due_on as string | null,
    isOverdue: row.is_overdue as boolean,
    isSettled: row.is_settled as boolean,
  }
}

async function normalizedTerm(query?: string): Promise<string | null> {
  const term = query?.trim()
  if (!term) return null

  const { data } = await supabase.rpc("normalize_person_name", { p_name: term })
  return (data as string | null) ?? null
}

export async function listCustomers(query?: string): Promise<CustomerRow[]> {
  let request = supabase.from("customers_overview").select(CUSTOMER_COLUMNS)

  const normalized = await normalizedTerm(query)
  if (normalized) {
    request = request.ilike("normalized_name", `%${normalized}%`)
  }

  const { data, error } = await request.order("full_name").limit(300)

  if (error) {
    throw new Error(`customer query failed: ${error.message}`)
  }

  return (data ?? []).map(toCustomerRow)
}

export async function listCustomersPaged({
  query,
  page = 1,
  pageSize = 50,
}: {
  query?: string
  page?: number
  pageSize?: number
}): Promise<CustomerPage> {
  const normalized = await normalizedTerm(query)

  const window = await pageWindow(
    () => {
      let countQuery = supabase
        .from("customers_overview")
        .select("id", { count: "exact", head: true })

      if (normalized) {
        countQuery = countQuery.ilike("normalized_name", `%${normalized}%`)
      }
      return countQuery
    },
    page,
    pageSize,
    "customer query failed"
  )

  let request = supabase
    .from("customers_overview")
    .select(CUSTOMER_COLUMNS)

  if (normalized) {
    request = request.ilike("normalized_name", `%${normalized}%`)
  }

  const { data, error } = await request
    .order("full_name")
    .range(window.start, window.end)

  if (error) {
    throw new Error(`customer query failed: ${error.message}`)
  }

  return {
    rows: (data ?? []).map(toCustomerRow),
    total: window.total,
    page: window.page,
    pageCount: window.pageCount,
  }
}

// One master, one reader: the detail of a patient and the period view live here
// with the rest of the customer reads.

export type CustomerSaleItem = {
  itemName: string
  quantity: number
  lineTotal: number
}

export type CustomerSale = {
  id: string
  occurredOn: string
  voided: boolean
  total: number
  paid: number
  refunded: number
  items: CustomerSaleItem[]
}

export type CustomerAppointment = {
  id: string
  scheduledOn: string
  status: string
}

export type CustomerDetail = {
  id: string
  fullName: string
  phone: string | null
  birthDate: string | null
  createdAt: string
  spentTotal: number
  refundedTotal: number
  balance: number
  soldTotal: number
  visits: number
  lastVisitOn: string | null
  nextDueOn: string | null
  isOverdue: boolean
  isSettled: boolean
  sales: CustomerSale[]
  appointments: CustomerAppointment[]
}

type IdRow = { id: string }

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const { data: overview, error } = await supabase
    .from("customers_overview")
    .select(
      "id, full_name, phone, created_at, sold_total, spent_total, refunded_total, balance, visits, last_visit_on, next_due_on, is_overdue, is_settled"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw new Error(`customer query failed: ${error.message}`)
  }
  if (!overview) return null

  const { data: master } = await supabase
    .from("customers")
    .select("birth_date")
    .eq("id", id)
    .maybeSingle()

  const { data: salesRows } = await supabase
    .from("sales")
    .select("id, occurred_on, voided_at")
    .eq("customer_id", id)
    .order("occurred_on", { ascending: false })

  const sales = salesRows ?? []
  const saleIds = sales.map((row) => row.id as string)

  const { data: totalsRows } = saleIds.length
    ? await supabase.from("sales_with_totals").select("id, total").in("id", saleIds)
    : { data: [] as { id: string; total: number }[] }

  const { data: itemRows } = saleIds.length
    ? await supabase
        .from("sale_lines")
        .select("sale_id, item_name, quantity, line_total")
        .in("sale_id", saleIds)
    : { data: [] as { sale_id: string; item_name: string; quantity: number; line_total: number }[] }

  const { data: paymentRows } = saleIds.length
    ? await supabase
        .from("sale_payments")
        .select("id, sale_id, amount")
        .in("sale_id", saleIds)
    : { data: [] as { id: string; sale_id: string; amount: number }[] }

  const paymentIds = (paymentRows ?? []).map((row) => row.id as string)

  const { data: receiptRows } = paymentIds.length
    ? await supabase
        .from("payment_receipts")
        .select("sale_payment_id, amount")
        .in("sale_payment_id", paymentIds)
    : { data: [] as { sale_payment_id: string; amount: number }[] }

  const { data: refundRows } = saleIds.length
    ? await supabase.from("sale_refunds").select("sale_id, amount").in("sale_id", saleIds)
    : { data: [] as { sale_id: string; amount: number }[] }

  const totalBySale = new Map<string, number>()
  for (const row of totalsRows ?? []) totalBySale.set(row.id as string, Number(row.total))

  const paymentToSale = new Map<string, string>()
  for (const row of paymentRows ?? []) paymentToSale.set(row.id as string, row.sale_id as string)

  const paidBySale = new Map<string, number>()
  for (const row of receiptRows ?? []) {
    const saleId = paymentToSale.get(row.sale_payment_id as string)
    if (!saleId) continue
    paidBySale.set(saleId, (paidBySale.get(saleId) ?? 0) + Number(row.amount))
  }

  const refundedBySale = new Map<string, number>()
  for (const row of refundRows ?? []) {
    const saleId = row.sale_id as string
    refundedBySale.set(saleId, (refundedBySale.get(saleId) ?? 0) + Number(row.amount))
  }

  const itemsBySale = new Map<string, CustomerSaleItem[]>()
  for (const row of itemRows ?? []) {
    const saleId = row.sale_id as string
    const list = itemsBySale.get(saleId) ?? []
    list.push({
      itemName: row.item_name as string,
      quantity: Number(row.quantity),
      lineTotal: Number(row.line_total),
    })
    itemsBySale.set(saleId, list)
  }

  const { data: appointmentRows } = await supabase
    .from("appointments")
    .select("id, scheduled_on, status")
    .eq("customer_id", id)
    .order("scheduled_on", { ascending: false })
    .limit(20)

  return {
    id: overview.id as string,
    fullName: overview.full_name as string,
    phone: overview.phone as string | null,
    birthDate: (master?.birth_date as string | null) ?? null,
    createdAt: overview.created_at as string,
    spentTotal: Number(overview.spent_total),
    refundedTotal: Number(overview.refunded_total),
    balance: Number(overview.balance),
    soldTotal: Number(overview.sold_total),
    visits: Number(overview.visits),
    lastVisitOn: overview.last_visit_on as string | null,
    nextDueOn: overview.next_due_on as string | null,
    isOverdue: overview.is_overdue as boolean,
    isSettled: overview.is_settled as boolean,
    sales: sales.map((row) => {
      const id = row.id as string
      return {
        id,
        occurredOn: row.occurred_on as string,
        voided: row.voided_at !== null,
        total: totalBySale.get(id) ?? 0,
        paid: paidBySale.get(id) ?? 0,
        refunded: refundedBySale.get(id) ?? 0,
        items: itemsBySale.get(id) ?? [],
      }
    }),
    appointments: (appointmentRows ?? []).map((row) => ({
      id: row.id as string,
      scheduledOn: row.scheduled_on as string,
      status: row.status as string,
    })),
  }
}

export type CustomerPeriodRow = {
  id: string
  fullName: string
  phone: string | null
  spent: number
  returns: number
  balance: number
  visits: number
  lastVisitOn: string | null
  nextDueOn: string | null
  isOverdue: boolean
  isSettled: boolean
}

export type CustomerPeriodPage = {
  rows: CustomerPeriodRow[]
  total: number
  page: number
  pageCount: number
}

export async function listCustomersInPeriod({
  from,
  to,
  query,
  page = 1,
  pageSize = 50,
}: {
  from: string
  to: string
  query?: string
  page?: number
  pageSize?: number
}): Promise<CustomerPeriodPage> {
  const { data: lineRows, error } = await supabase
    .from("sale_lines")
    .select("sale_id, customer_id, occurred_on, line_total, voided")
    .gte("occurred_on", from)
    .lte("occurred_on", to)

  if (error) {
    throw new Error(`period sales query failed: ${error.message}`)
  }

  const byCustomer = new Map<
    string,
    { sales: Set<string>; spent: number; lastSaleOn: string }
  >()
  const saleIdSet = new Set<string>()

  for (const row of lineRows ?? []) {
    if (row.voided) continue
    const customerId = row.customer_id as string
    const saleId = row.sale_id as string
    const occurredOn = row.occurred_on as string
    const entry = byCustomer.get(customerId) ?? {
      sales: new Set<string>(),
      spent: 0,
      lastSaleOn: occurredOn,
    }
    entry.sales.add(saleId)
    entry.spent += Number(row.line_total)
    if (occurredOn > entry.lastSaleOn) entry.lastSaleOn = occurredOn
    byCustomer.set(customerId, entry)
    saleIdSet.add(saleId)
  }

  if (byCustomer.size === 0) {
    return { rows: [], total: 0, page: 1, pageCount: 1 }
  }

  const saleIds = [...saleIdSet]

  const { data: refundRows } = saleIds.length
    ? await supabase
        .from("sale_refunds")
        .select("sale_id, amount")
        .in("sale_id", saleIds)
    : { data: [] as { sale_id: string; amount: number }[] }

  const refundBySale = new Map<string, number>()
  for (const row of refundRows ?? []) {
    const saleId = row.sale_id as string
    refundBySale.set(saleId, (refundBySale.get(saleId) ?? 0) + Number(row.amount))
  }

  const { data: customerRows, error: customerError } = await supabase
    .from("customers_overview")
    .select(
      "id, full_name, normalized_name, phone, balance, last_visit_on, next_due_on, is_overdue, is_settled"
    )
    .in("id", [...byCustomer.keys()])

  if (customerError) {
    throw new Error(`period customers query failed: ${customerError.message}`)
  }

  let normalized: string | null = null
  const term = query?.trim()
  if (term) {
    const { data } = await supabase.rpc("normalize_person_name", { p_name: term })
    normalized = (data as string | null) ?? null
  }

  const all = (customerRows ?? [])
    .filter(
      (row) => !normalized || (row.normalized_name as string).includes(normalized)
    )
    .map((row) => {
      const entry = byCustomer.get(row.id as string)!
      let returns = 0
      for (const saleId of entry.sales) {
        returns += refundBySale.get(saleId) ?? 0
      }
      return {
        id: row.id as string,
        fullName: row.full_name as string,
        phone: row.phone as string | null,
        spent: Math.round(entry.spent * 100) / 100,
        returns: Math.round(returns * 100) / 100,
        balance: Number(row.balance),
        visits: entry.sales.size,
        lastVisitOn: row.last_visit_on as string | null,
        nextDueOn: row.next_due_on as string | null,
        isOverdue: row.is_overdue as boolean,
        isSettled: row.is_settled as boolean,
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  const current = Math.max(1, Math.trunc(page) || 1)
  const start = (current - 1) * pageSize

  return {
    rows: all.slice(start, start + pageSize),
    total: all.length,
    page: current,
    pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
  }
}
