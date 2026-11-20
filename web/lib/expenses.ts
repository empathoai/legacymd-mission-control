import "server-only"

import { supabase } from "@/lib/supabase/server"

export type ExpenseMonthStatus = "open" | "closed"

export type ExpenseMonth = {
  id: string
  period: string
  status: ExpenseMonthStatus
  total: number
  entries: number
  closedAt: string | null
  sold: number
  returned: number
  netRevenue: number
  expenses: number
  result: number
}

export type ExpenseLine = {
  id: string
  itemId: string
  itemName: string
  categoryLabel: string
  supplierId: string | null
  supplierName: string | null
  amount: number
  note: string | null
  voided: boolean
  voidReason: string | null
}

export type ExpenseAudit = {
  changedAt: string
  oldStatus: string
  newStatus: string
  changedBy: string
  reason: string
}

export type ExpenseMonthDetail = ExpenseMonth & {
  lines: ExpenseLine[]
  categories: { label: string; amount: number }[]
  audit: ExpenseAudit[]
}

export type ExpenseItemOption = { id: string; name: string; categoryLabel: string }
export type SupplierOption = { id: string; name: string }
export type ExpenseCategoryOption = { id: string; label: string }

function r2(value: number): number {
  return Math.round(value * 100) / 100
}

type RawLine = {
  id: string
  item_id: string
  supplier_id: string | null
  amount: number
  note: string | null
  voided_at: string | null
  void_reason: string | null
  expense_items: { name: string; expense_categories: { label: string } | { label: string }[] | null } | null
  suppliers: { name: string } | { name: string }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const LINE_COLUMNS =
  "id, item_id, supplier_id, amount, note, voided_at, void_reason, expense_items ( name, expense_categories ( label ) ), suppliers ( name )"

/**
 * One row per month: the stored total for a closed month, the live sum for an
 * open one, and the money the month produced next to what it spent.
 */
export async function listExpenseMonths(): Promise<ExpenseMonth[]> {
  const [periods, entries, pl, money] = await Promise.all([
    supabase
      .from("expense_periods")
      .select("id, period, status, total, closed_at")
      .order("period", { ascending: false }),
    supabase.from("expense_entries").select("period_id, amount, voided_at"),
    supabase.from("monthly_pl").select("month, revenue, expenses"),
    supabase.from("monthly_money").select("month, returned, net_revenue"),
  ])

  if (periods.error) throw new Error(`expense months query failed: ${periods.error.message}`)
  if (entries.error) throw new Error(`expense entries query failed: ${entries.error.message}`)

  const live = new Map<string, { sum: number; count: number }>()
  for (const row of entries.data ?? []) {
    if (row.voided_at) continue
    const key = row.period_id as string
    const current = live.get(key) ?? { sum: 0, count: 0 }
    current.sum += Number(row.amount)
    current.count += 1
    live.set(key, current)
  }

  const revenue = new Map(
    (pl.data ?? []).map((row) => [row.month as string, row as { revenue: number; expenses: number }])
  )
  const net = new Map(
    (money.data ?? []).map((row) => [row.month as string, row as { returned: number; net_revenue: number }])
  )

  return (periods.data ?? []).map((row) => {
    const period = row.period as string
    const aggregate = live.get(row.id as string) ?? { sum: 0, count: 0 }
    const sold = Number(revenue.get(period)?.revenue ?? 0)
    const returned = Number(net.get(period)?.returned ?? 0)
    const netRevenue = Number(net.get(period)?.net_revenue ?? 0)
    const expenses = Number(revenue.get(period)?.expenses ?? 0)
    const closed = row.status === "closed"

    return {
      id: row.id as string,
      period,
      status: closed ? "closed" : "open",
      total: closed ? Number(row.total ?? 0) : r2(aggregate.sum),
      entries: aggregate.count,
      closedAt: (row.closed_at as string | null) ?? null,
      sold: r2(sold),
      returned: r2(returned),
      netRevenue: r2(netRevenue),
      expenses: r2(expenses),
      result: r2(netRevenue - expenses),
    }
  })
}

export async function getExpenseMonth(period: string): Promise<ExpenseMonthDetail | null> {
  const months = await listExpenseMonths()
  const month = months.find((row) => row.period === period)
  if (!month) return null

  const [lines, audit] = await Promise.all([
    supabase
      .from("expense_entries")
      .select(LINE_COLUMNS)
      .eq("period_id", month.id)
      .order("created_at"),
    supabase
      .from("expense_period_changes")
      .select("changed_at, old_status, new_status, changed_by, reason")
      .eq("period_id", month.id)
      .order("changed_at", { ascending: false }),
  ])

  if (lines.error) throw new Error(`expense lines query failed: ${lines.error.message}`)

  const rows = (lines.data as unknown as RawLine[]).map((row) => {
    const item = one(row.expense_items)
    return {
      id: row.id,
      itemId: row.item_id,
      itemName: item?.name ?? "(unknown)",
      categoryLabel: one(item?.expense_categories ?? null)?.label ?? "—",
      supplierId: row.supplier_id,
      supplierName: one(row.suppliers)?.name ?? null,
      amount: Number(row.amount),
      note: row.note,
      voided: row.voided_at !== null,
      voidReason: row.void_reason,
    }
  })

  const byCategory = new Map<string, number>()
  for (const row of rows) {
    if (row.voided) continue
    byCategory.set(row.categoryLabel, r2((byCategory.get(row.categoryLabel) ?? 0) + row.amount))
  }

  return {
    ...month,
    lines: rows,
    categories: [...byCategory.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount),
    audit: (audit.data ?? []).map((row) => ({
      changedAt: row.changed_at as string,
      oldStatus: row.old_status as string,
      newStatus: row.new_status as string,
      changedBy: row.changed_by as string,
      reason: row.reason as string,
    })),
  }
}

export async function listExpenseItems(): Promise<ExpenseItemOption[]> {
  const { data, error } = await supabase
    .from("expense_items")
    .select("id, name, active, expense_categories ( label )")
    .eq("active", true)
    .order("name")

  if (error) throw new Error(`expense items query failed: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    categoryLabel: one(row.expense_categories as { label: string } | { label: string }[] | null)?.label ?? "—",
  }))
}

export async function listSuppliers(): Promise<SupplierOption[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("active", true)
    .order("name")

  if (error) throw new Error(`suppliers query failed: ${error.message}`)

  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }))
}

export async function listExpenseCategories(): Promise<ExpenseCategoryOption[]> {
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, label")
    .order("sort_order")

  if (error) throw new Error(`expense categories query failed: ${error.message}`)

  return (data ?? []).map((row) => ({ id: row.id as string, label: row.label as string }))
}
