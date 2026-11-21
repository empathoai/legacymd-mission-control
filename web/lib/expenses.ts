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
  fixed: number
  variable: number
  acquisition: number
  clinicOpEx: number
  operatingProfit: number
  ownerDraw: number
  capex: number
}

export type ExpenseLine = {
  id: string
  itemId: string
  itemName: string
  categoryLabel: string
  costBehavior: ExpenseCostBehavior
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

export type ExpenseCostBehavior =
  | "fixed"
  | "variable"
  | "acquisition"
  | "owner_draw"
  | "capex"

export type ExpenseItemOption = {
  id: string
  name: string
  categoryLabel: string
  costBehavior: ExpenseCostBehavior
  guidance: string | null
}
export type SupplierOption = { id: string; name: string }
export type ExpenseCategoryOption = { id: string; label: string }

export type ExpenseMatrixRow = {
  itemId: string
  itemName: string
  categoryLabel: string
  costBehavior: ExpenseCostBehavior
  byPeriod: Record<string, number>
  total: number
}

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
  expense_items: {
    name: string
    cost_behavior: ExpenseCostBehavior | null
    expense_categories: { label: string } | { label: string }[] | null
  } | null
  suppliers: { name: string } | { name: string }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const LINE_COLUMNS =
  "id, item_id, supplier_id, amount, note, voided_at, void_reason, expense_items ( name, cost_behavior, expense_categories ( label ) ), suppliers ( name )"

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
    supabase
      .from("expense_entries")
      .select("period_id, amount, voided_at, expense_items ( cost_behavior )"),
    supabase.from("monthly_pl").select("month, revenue, expenses"),
    supabase.from("monthly_money").select("month, returned, net_revenue"),
  ])

  if (periods.error) throw new Error(`expense months query failed: ${periods.error.message}`)
  if (entries.error) throw new Error(`expense entries query failed: ${entries.error.message}`)

  type PeriodAgg = {
    sum: number
    count: number
    fixed: number
    variable: number
    acquisition: number
    ownerDraw: number
    capex: number
  }
  const live = new Map<string, PeriodAgg>()
  for (const row of entries.data ?? []) {
    if (row.voided_at) continue
    const key = row.period_id as string
    const current = live.get(key) ?? {
      sum: 0,
      count: 0,
      fixed: 0,
      variable: 0,
      acquisition: 0,
      ownerDraw: 0,
      capex: 0,
    }
    const amt = Number(row.amount)
    const item = one(
      row.expense_items as
        | { cost_behavior: ExpenseCostBehavior | null }
        | { cost_behavior: ExpenseCostBehavior | null }[]
        | null
    )
    const behavior = item?.cost_behavior ?? "fixed"
    current.sum += amt
    current.count += 1
    if (behavior === "variable") current.variable += amt
    else if (behavior === "acquisition") current.acquisition += amt
    else if (behavior === "owner_draw") current.ownerDraw += amt
    else if (behavior === "capex") current.capex += amt
    else current.fixed += amt
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
    const aggregate = live.get(row.id as string) ?? {
      sum: 0,
      count: 0,
      fixed: 0,
      variable: 0,
      acquisition: 0,
      ownerDraw: 0,
      capex: 0,
    }
    const sold = Number(revenue.get(period)?.revenue ?? 0)
    const returned = Number(net.get(period)?.returned ?? 0)
    const netRevenue = Number(net.get(period)?.net_revenue ?? 0)
    const expenses = Number(revenue.get(period)?.expenses ?? 0)
    const closed = row.status === "closed"
    const fixed = r2(aggregate.fixed)
    const variable = r2(aggregate.variable)
    const acquisition = r2(aggregate.acquisition)
    const ownerDraw = r2(aggregate.ownerDraw)
    const capex = r2(aggregate.capex)
    const clinicOpEx = r2(fixed + variable + acquisition)
    const operatingProfit = r2(netRevenue - clinicOpEx)

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
      fixed,
      variable,
      acquisition,
      clinicOpEx,
      operatingProfit,
      ownerDraw,
      capex,
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
      costBehavior: item?.cost_behavior ?? "fixed",
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
    .select("id, name, active, cost_behavior, guidance, expense_categories ( label )")
    .eq("active", true)
    .order("name")

  if (error) throw new Error(`expense items query failed: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    categoryLabel: one(row.expense_categories as { label: string } | { label: string }[] | null)?.label ?? "—",
    costBehavior: (row.cost_behavior as ExpenseCostBehavior | null) ?? "fixed",
    guidance: (row.guidance as string | null) ?? null,
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

export async function listExpenseMatrix(periods: string[]): Promise<ExpenseMatrixRow[]> {
  if (periods.length === 0) return []
  const periodSet = new Set(periods)

  const { data, error } = await supabase
    .from("expense_entries")
    .select(
      "amount, voided_at, expense_periods!inner ( period ), expense_items ( id, name, cost_behavior, expense_categories ( label ) )"
    )
    .is("voided_at", null)

  if (error) throw new Error(`expense matrix query failed: ${error.message}`)

  type RawMatrix = {
    amount: number
    expense_periods: { period: string } | { period: string }[] | null
    expense_items: {
      id: string
      name: string
      cost_behavior: ExpenseCostBehavior | null
      expense_categories: { label: string } | { label: string }[] | null
    } | null
  }

  const byItem = new Map<string, ExpenseMatrixRow>()
  for (const row of (data as unknown as RawMatrix[]) ?? []) {
    const period = one(row.expense_periods)?.period
    if (!period || !periodSet.has(period)) continue
    const item = one(row.expense_items)
    if (!item) continue

    const entry = byItem.get(item.id) ?? {
      itemId: item.id,
      itemName: item.name,
      categoryLabel: one(item.expense_categories)?.label ?? "—",
      costBehavior: item.cost_behavior ?? "fixed",
      byPeriod: {},
      total: 0,
    }
    const amt = Number(row.amount)
    entry.byPeriod[period] = r2((entry.byPeriod[period] ?? 0) + amt)
    entry.total = r2(entry.total + amt)
    byItem.set(item.id, entry)
  }

  return Array.from(byItem.values()).sort((a, b) => b.total - a.total)
}
