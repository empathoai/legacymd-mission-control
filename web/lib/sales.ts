import "server-only"

import { supabase } from "@/lib/supabase/server"
import { pageWindow } from "@/lib/pagination"

export const SALE_LINES_PER_PAGE = 20

export type SaleLine = {
  saleItemId: string
  saleId: string
  occurredOn: string
  customerId: string
  customerName: string
  voided: boolean
  kind: "treatment" | "product" | "service" | "other"
  unitType: "unit" | "package" | null
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
  listPrice: number | null
  discount: number
}

export type SaleLinePage = {
  rows: SaleLine[]
  total: number
  page: number
  pageCount: number
  /** Sum of the line totals in the filter, voided lines excluded. */
  totalAmount: number
  statusBySale: Record<string, SaleStatus>
}

export type SaleMoney = {
  total: number
  collected: number
  returned: number
  pendingReturn: number
  balance: number
  voided: boolean
}

export type SaleStatus = "paid" | "partial" | "unpaid" | "refunded" | "voided"

/** What the money says about the sale: a sale is its receipts, never a stored flag. */
export function saleStatus(money: SaleMoney): SaleStatus {
  if (money.voided) return "voided"
  if (money.returned > 0) return "refunded"
  if (money.balance <= 0.005) return "paid"
  if (money.collected > 0.005) return "partial"
  return "unpaid"
}

async function moneyBySaleId(ids: string[]): Promise<Record<string, SaleStatus>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from("sale_money")
    .select("sale_id, total, collected, returned, pending_return, balance, voided")
    .in("sale_id", ids)
  if (error) throw new Error(`sale money query failed: ${error.message}`)

  const map: Record<string, SaleStatus> = {}
  for (const row of data ?? []) {
    map[row.sale_id as string] = saleStatus({
      total: Number(row.total),
      collected: Number(row.collected),
      returned: Number(row.returned),
      pendingReturn: Number(row.pending_return),
      balance: Number(row.balance),
      voided: Boolean(row.voided),
    })
  }
  return map
}

export async function listSaleLines(
  page = 1,
  filter?: { date?: string; from?: string; to?: string }
): Promise<SaleLinePage> {
  const window = await pageWindow(
    () => {
      let countQuery = supabase
        .from("sale_lines")
        .select("sale_item_id", { count: "exact", head: true })

      if (filter?.date) countQuery = countQuery.eq("occurred_on", filter.date)
      if (filter?.from) countQuery = countQuery.gte("occurred_on", filter.from)
      if (filter?.to) countQuery = countQuery.lte("occurred_on", filter.to)

      return countQuery
    },
    page,
    SALE_LINES_PER_PAGE,
    "sale lines query failed"
  )

  let query = supabase
    .from("sale_lines")
    .select(
      "sale_item_id, sale_id, occurred_on, customer_id, customer_name, voided, kind, unit_type, item_name, quantity, unit_price, line_total, list_price, discount"
    )

  if (filter?.date) {
    query = query.eq("occurred_on", filter.date)
  }
  if (filter?.from) {
    query = query.gte("occurred_on", filter.from)
  }
  if (filter?.to) {
    query = query.lte("occurred_on", filter.to)
  }

  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("sale_id", { ascending: true })
    .range(window.start, window.end)

  if (error) {
    throw new Error(`sale lines query failed: ${error.message}`)
  }

  const rows: SaleLine[] = (data ?? []).map((row) => ({
    saleItemId: row.sale_item_id as string,
    saleId: row.sale_id as string,
    occurredOn: row.occurred_on as string,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    voided: row.voided as boolean,
    kind: row.kind as SaleLine["kind"],
    unitType: (row.unit_type as "unit" | "package" | null) ?? null,
    itemName: (row.item_name as string | null) ?? "—",
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    listPrice: row.list_price === null ? null : Number(row.list_price),
    discount: Number(row.discount),
  }))

  let sumQuery = supabase
    .from("sale_lines")
    .select("line_total")
    .eq("voided", false)
  if (filter?.date) sumQuery = sumQuery.eq("occurred_on", filter.date)
  if (filter?.from) sumQuery = sumQuery.gte("occurred_on", filter.from)
  if (filter?.to) sumQuery = sumQuery.lte("occurred_on", filter.to)

  const [{ data: sums, error: sumError }, statusBySale] = await Promise.all([
    sumQuery,
    moneyBySaleId([...new Set(rows.map((row) => row.saleId))]),
  ])
  if (sumError) throw new Error(`sale sum query failed: ${sumError.message}`)

  const totalAmount = (sums ?? []).reduce(
    (sum, row) => sum + Number(row.line_total),
    0
  )

  return {
    rows,
    total: window.total,
    page: window.page,
    pageCount: window.pageCount,
    totalAmount,
    statusBySale,
  }
}

export type SalePayment = {
  id: string
  dueOn: string
  amount: number
  state: "pending" | "void"
  method: string | null
  receipts: { id: string; amount: number; receivedOn: string; source: string | null }[]
}

export type SaleDetail = {
  id: string
  occurredOn: string
  customerId: string
  customerName: string
  visitNumber: number | null
  notes: string | null
  voided: boolean
  voidReason: string | null
  money: SaleMoney
  status: SaleStatus
  lines: SaleLine[]
  payments: SalePayment[]
  refunds: { id: string; amount: number; refundedOn: string; state: string; reason: string | null }[]
}

/** One sale, read the way the desk needs it: its lines, its plan, its receipts, its returns. */
export async function getSale(id: string): Promise<SaleDetail | null> {
  const { data: moneyRow, error: moneyError } = await supabase
    .from("sale_money")
    .select("sale_id, total, collected, returned, pending_return, balance, voided")
    .eq("sale_id", id)
    .maybeSingle()
  if (moneyError) throw new Error(`sale money query failed: ${moneyError.message}`)
  if (!moneyRow) return null

  const [saleRes, linesRes, paymentsRes, refundsRes, methodsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("occurred_on, customer_id, visit_number, notes, voided_at, void_reason")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sale_lines")
      .select(
        "sale_item_id, sale_id, occurred_on, customer_id, customer_name, voided, kind, unit_type, item_name, quantity, unit_price, line_total, list_price, discount"
      )
      .eq("sale_id", id)
      .order("item_name"),
    supabase
      .from("sale_payments")
      .select("id, due_on, amount, status, method_id")
      .eq("sale_id", id)
      .order("due_on"),
    supabase
      .from("sale_refunds")
      .select("id, amount, refunded_on, state, reason")
      .eq("sale_id", id)
      .order("refunded_on"),
    supabase.from("payment_methods").select("id, label"),
  ])

  if (saleRes.error) throw new Error(`sale query failed: ${saleRes.error.message}`)
  if (linesRes.error) throw new Error(`sale lines query failed: ${linesRes.error.message}`)
  if (paymentsRes.error) throw new Error(`sale payments query failed: ${paymentsRes.error.message}`)
  if (refundsRes.error) throw new Error(`sale refunds query failed: ${refundsRes.error.message}`)
  if (methodsRes.error) throw new Error(`payment methods query failed: ${methodsRes.error.message}`)

  const lines: SaleLine[] = (linesRes.data ?? []).map((row) => ({
    saleItemId: row.sale_item_id as string,
    saleId: row.sale_id as string,
    occurredOn: row.occurred_on as string,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    voided: row.voided as boolean,
    kind: row.kind as SaleLine["kind"],
    unitType: (row.unit_type as "unit" | "package" | null) ?? null,
    itemName: (row.item_name as string | null) ?? "—",
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    listPrice: row.list_price === null ? null : Number(row.list_price),
    discount: Number(row.discount),
  }))

  const methodName = new Map(
    (methodsRes.data ?? []).map((row) => [row.id as string, row.label as string])
  )

  const paymentIds = (paymentsRes.data ?? []).map((row) => row.id as string)
  const receiptsRes = paymentIds.length
    ? await supabase
        .from("payment_receipts")
        .select("id, sale_payment_id, amount, received_on, source")
        .in("sale_payment_id", paymentIds)
        .order("received_on")
    : { data: [], error: null }
  if (receiptsRes.error) {
    throw new Error(`receipts query failed: ${receiptsRes.error.message}`)
  }

  const receiptsByPayment = new Map<string, SalePayment["receipts"]>()
  for (const row of receiptsRes.data ?? []) {
    const key = row.sale_payment_id as string
    const list = receiptsByPayment.get(key) ?? []
    list.push({
      id: row.id as string,
      amount: Number(row.amount),
      receivedOn: row.received_on as string,
      source: (row.source as string | null) ?? null,
    })
    receiptsByPayment.set(key, list)
  }

  const money: SaleMoney = {
    total: Number(moneyRow.total),
    collected: Number(moneyRow.collected),
    returned: Number(moneyRow.returned),
    pendingReturn: Number(moneyRow.pending_return),
    balance: Number(moneyRow.balance),
    voided: Boolean(moneyRow.voided),
  }

  return {
    id,
    occurredOn: (saleRes.data?.occurred_on as string) ?? lines[0]?.occurredOn ?? "",
    customerId: (saleRes.data?.customer_id as string) ?? "",
    customerName: lines[0]?.customerName ?? "—",
    visitNumber: (saleRes.data?.visit_number as number | null) ?? null,
    notes: (saleRes.data?.notes as string | null) ?? null,
    voided: Boolean(saleRes.data?.voided_at),
    voidReason: (saleRes.data?.void_reason as string | null) ?? null,
    money,
    status: saleStatus(money),
    lines,
    payments: (paymentsRes.data ?? []).map((row) => ({
      id: row.id as string,
      dueOn: row.due_on as string,
      amount: Number(row.amount),
      state: (row.status as "pending" | "void") ?? "pending",
      method: methodName.get(row.method_id as string) ?? null,
      receipts: receiptsByPayment.get(row.id as string) ?? [],
    })),
    refunds: (refundsRes.data ?? []).map((row) => ({
      id: row.id as string,
      amount: Number(row.amount),
      refundedOn: row.refunded_on as string,
      state: row.state as string,
      reason: (row.reason as string | null) ?? null,
    })),
  }
}
