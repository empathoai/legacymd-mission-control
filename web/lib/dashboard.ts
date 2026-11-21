import "server-only"

import { addDays, format, parseISO } from "date-fns"

import { clinicToday } from "@/lib/dates"
import { supabase } from "@/lib/supabase/server"

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function shiftDay(isoDay: string, deltaDays: number): string {
  return format(addDays(parseISO(isoDay), deltaDays), "yyyy-MM-dd")
}

// Fixed overhead is whatever the expense concept says it is, never a list of names.
// variable, acquisition, owner_draw and capex are excluded because they are not the
// cost of keeping the clinic open.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailySaleRow = {
  saleId: string
  patientId: string
  patientName: string
  itemsSummary: string
  itemsCount: number
  isFirstVisit: boolean
  source: string | null
  total: number
}

export type PaymentMethodBreakdown = {
  slug: string
  label: string
  amount: number
  count: number
  riskLane: "instant" | "installment"
}

export type DueInstallmentRow = {
  id: string
  saleId: string
  patientId: string
  patientName: string
  phone: string | null
  dueOn: string
  daysOverdue: number
  remaining: number
  method: string
}

export type DailyDashboardData = {
  date: string
  soldToday: number
  collectedToday: number
  receiptsCountToday: number
  salesCount: number
  avgTicketToday: number
  patientsSeenToday: number
  newPatientsToday: number
  repeatPatientsToday: number
  salesToday: DailySaleRow[]
  paymentMethods: PaymentMethodBreakdown[]
  dueInstallments: DueInstallmentRow[]
  overdueTotal: number
  overdueCount: number
  dueTodayTotal: number
  dueTodayCount: number
}

export type WeeklyDayPoint = {
  day: string
  date: string
  sold: number
  collected: number
}

export type CategoryMixRow = {
  category: string
  label: string
  salesCount: number
  revenue: number
  avgTicket: number
  sharePct: number
}

export type KindMixRow = {
  kind: string
  lines: number
  revenue: number
  sharePct: number
}

export type ChannelQualityRow = {
  channel: string
  newPatients: number
  firstVisitRevenue: number
  avgFirstTicket: number
  sharePct: number
}

export type WeeklyDashboardData = {
  from: string
  to: string
  sold: number
  prevSold: number
  soldDeltaPct: number | null
  collected: number
  salesCount: number
  avgTicket: number
  aovDeltaPct: number | null
  newPatients: number
  repeatPatients: number
  repeatRevenuePct: number
  discountsGiven: number
  listValue: number
  discountPct: number
  dailySeries: WeeklyDayPoint[]
  byCategory: CategoryMixRow[]
  byKind: KindMixRow[]
  channels: ChannelQualityRow[]
}

export type MonthlyTrendPoint = {
  month: string
  label: string
  grossRevenue: number
  netRevenue: number
  collected: number
  expenses: number
  grossMargin: number
  cashResult: number
  newRevenue: number
  repeatRevenue: number
}

export type MonthlyCategoryProfitRow = {
  category: string
  label: string
  revenue: number
  revenueWithCost: number
  cost: number
  margin: number
  marginPct: number | null
}

export type MonthlyItemProfitRow = {
  itemId: string
  itemName: string
  kind: string
  units: number
  revenue: number
  cost: number
  margin: number
  marginPct: number | null
  costKnown: boolean
}

export type ExpenseSliceRow = {
  category: string
  label: string
  amount: number
  sharePct: number
}

export type StripeForecastRow = {
  month: string
  label: string
  expected: number
  stripeCollected: number
  overdue: number
}

export type ReactivationRow = {
  id: string
  name: string
  phone: string | null
  visits: number
  spentTotal: number
  lastVisitOn: string
  daysSinceLastVisit: number
  lastItem: string | null
}

export type MonthlyDashboardData = {
  selectedMonth: string
  availableMonths: string[]
  periodStatus: "open" | "closed" | "none"
  grossRevenue: number
  returned: number
  adjustmentRevenue: number
  netRevenue: number
  netRevenueDeltaPct: number | null
  collected: number
  cogs: number
  revenueWithCost: number
  costCoveragePct: number
  grossMargin: number
  grossMarginPct: number | null
  grossMarginDeltaPts: number | null
  expensesTotal: number
  recurringFixedExpenses: number
  ownerDraw: number
  capexExpenses: number
  clinicOperatingProfit: number
  cashResult: number
  adSpend: number
  marketingConsulting: number
  newPatients: number
  repeatVisits: number
  cacAdOnly: number | null
  cacBlended: number | null
  roasNew: number | null
  discountTotal: number
  discountListValue: number
  discountPct: number
  instantCollectedPct: number
  installmentRiskPct: number
  sixMonthTrend: MonthlyTrendPoint[]
  profitabilityByCategory: MonthlyCategoryProfitRow[]
  topItems: MonthlyItemProfitRow[]
  expensesByCategory: ExpenseSliceRow[]
  stripeForecast: StripeForecastRow[]
  reactivationWatchlist: ReactivationRow[]
}

// ---------------------------------------------------------------------------
// 1. Daily Dashboard
// ---------------------------------------------------------------------------

export async function getDailyDashboard(targetDate?: string): Promise<DailyDashboardData> {
  const date = targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : clinicToday()

  const [
    salesRes,
    linesRes,
    receiptsRes,
    pendingPaymentsRes,
    methodsRes,
    sourcesRes,
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id, customer_id, is_first_visit, source_id, customers!inner(full_name)")
      .eq("occurred_on", date)
      .is("voided_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("sale_lines")
      .select("sale_id, item_name, line_total, voided")
      .eq("occurred_on", date)
      .eq("voided", false),
    supabase
      .from("payment_receipts")
      .select("id, amount, sale_payment_id, sale_payments!inner(payment_method_id)")
      .eq("received_on", date),
    supabase
      .from("sale_payments")
      .select(
        "id, sale_id, amount, due_on, payment_method_id, sales!inner(customer_id, voided_at, customers!inner(full_name, phone))"
      )
      .eq("status", "pending")
      .lte("due_on", date)
      .is("sales.voided_at", null)
      .order("due_on", { ascending: true }),
    supabase.from("payment_methods").select("id, slug, label"),
    supabase.from("sources").select("id, label"),
  ])

  const pendingPaymentIds = (pendingPaymentsRes.data ?? []).map((p) => p.id as string)
  const receiptsForPendingRes =
    pendingPaymentIds.length > 0
      ? await supabase
          .from("payment_receipts")
          .select("sale_payment_id, amount")
          .in("sale_payment_id", pendingPaymentIds)
      : { data: [] as Array<{ sale_payment_id: string; amount: unknown }> }

  const methodMap = new Map(
    (methodsRes.data ?? []).map((m) => [
      m.id as string,
      { slug: m.slug as string, label: m.label as string },
    ])
  )
  const sourceMap = new Map(
    (sourcesRes.data ?? []).map((s) => [s.id as string, s.label as string])
  )

  // Sales & lines today
  const sales = salesRes.data ?? []
  const saleTotalById = new Map<string, number>()
  const saleItemsById = new Map<string, string[]>()
  let soldToday = 0
  for (const line of linesRes.data ?? []) {
    const amt = num(line.line_total)
    soldToday += amt
    const sid = line.sale_id as string
    saleTotalById.set(sid, round2((saleTotalById.get(sid) ?? 0) + amt))
    const list = saleItemsById.get(sid) ?? []
    list.push(line.item_name as string)
    saleItemsById.set(sid, list)
  }

  const newCustomerIds = new Set<string>()
  const allCustomerIds = new Set<string>()
  const salesToday: DailySaleRow[] = sales.map((s) => {
    const cid = s.customer_id as string
    const sid = s.id as string
    const cust = s.customers as unknown as { full_name: string } | null
    allCustomerIds.add(cid)
    if (s.is_first_visit) newCustomerIds.add(cid)
    const itemNames = saleItemsById.get(sid) ?? []
    const itemsSummary =
      itemNames.length === 0
        ? "—"
        : itemNames.length === 1
          ? itemNames[0]
          : `${itemNames[0]} +${itemNames.length - 1} more`
    return {
      saleId: sid,
      patientId: cid,
      patientName: cust?.full_name ?? "Unknown",
      itemsSummary,
      itemsCount: itemNames.length,
      isFirstVisit: Boolean(s.is_first_visit),
      source: s.source_id ? sourceMap.get(s.source_id as string) ?? null : null,
      total: round2(saleTotalById.get(sid) ?? 0),
    }
  })

  const patientsSeenToday = allCustomerIds.size
  const newPatientsToday = newCustomerIds.size
  const repeatPatientsToday = Math.max(0, patientsSeenToday - newPatientsToday)
  const avgTicketToday = sales.length > 0 ? round2(soldToday / sales.length) : 0

  // Collected today + method breakdown
  let collectedToday = 0
  const receipts = receiptsRes.data ?? []
  const methodTotals = new Map<string, PaymentMethodBreakdown>()
  for (const r of receipts) {
    const amt = num(r.amount)
    collectedToday += amt
    const sp = r.sale_payments as unknown as { payment_method_id: string } | null
    const info = sp ? methodMap.get(sp.payment_method_id) : undefined
    const slug = info?.slug ?? "other"
    const label = info?.label ?? "Other"
    const existing = methodTotals.get(slug)
    if (existing) {
      existing.amount = round2(existing.amount + amt)
      existing.count += 1
    } else {
      methodTotals.set(slug, {
        slug,
        label,
        amount: round2(amt),
        count: 1,
        riskLane: slug === "stripe" ? "installment" : "instant",
      })
    }
  }

  const paymentMethods = Array.from(methodTotals.values()).sort((a, b) => b.amount - a.amount)

  // Pending / overdue installments <= date (strictly separated: overdue vs due today)
  const paidByPaymentId = new Map<string, number>()
  for (const rc of receiptsForPendingRes.data ?? []) {
    const pid = rc.sale_payment_id as string
    paidByPaymentId.set(pid, (paidByPaymentId.get(pid) ?? 0) + num(rc.amount))
  }

  const todayMs = parseISO(date).getTime()
  const dueInstallments: DueInstallmentRow[] = []
  for (const p of pendingPaymentsRes.data ?? []) {
    const paid = paidByPaymentId.get(p.id as string) ?? 0
    const remaining = round2(num(p.amount) - paid)
    if (remaining <= 0.005) continue
    const saleObj = p.sales as unknown as {
      customer_id: string
      customers: { full_name: string; phone: string | null }
    }
    const dueOn = p.due_on as string
    const daysOverdue = Math.max(0, Math.round((todayMs - parseISO(dueOn).getTime()) / 86_400_000))
    const mInfo = methodMap.get(p.payment_method_id as string)
    dueInstallments.push({
      id: p.id as string,
      saleId: p.sale_id as string,
      patientId: saleObj.customer_id,
      patientName: saleObj.customers?.full_name ?? "Unknown",
      phone: saleObj.customers?.phone ?? null,
      dueOn,
      daysOverdue,
      remaining,
      method: mInfo?.label ?? "Other",
    })
  }

  const overdueOnly = dueInstallments.filter((d) => d.daysOverdue > 0)
  const dueTodayOnly = dueInstallments.filter((d) => d.daysOverdue === 0)
  const overdueTotal = round2(overdueOnly.reduce((s, d) => s + d.remaining, 0))
  const dueTodayTotal = round2(dueTodayOnly.reduce((s, d) => s + d.remaining, 0))

  return {
    date,
    soldToday: round2(soldToday),
    collectedToday: round2(collectedToday),
    receiptsCountToday: receipts.length,
    salesCount: sales.length,
    avgTicketToday,
    patientsSeenToday,
    newPatientsToday,
    repeatPatientsToday,
    salesToday,
    paymentMethods,
    dueInstallments,
    overdueTotal,
    overdueCount: overdueOnly.length,
    dueTodayTotal,
    dueTodayCount: dueTodayOnly.length,
  }
}

// ---------------------------------------------------------------------------
// 2. Weekly Dashboard (7-day rolling window ending on `endDate`)
// ---------------------------------------------------------------------------

export async function getWeeklyDashboard(endDate?: string): Promise<WeeklyDashboardData> {
  const to = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : clinicToday()
  const from = shiftDay(to, -6)
  const prevTo = shiftDay(from, -1)
  const prevFrom = shiftDay(prevTo, -6)

  const [
    salesRes,
    prevSalesRes,
    itemsRes,
    prevItemsRes,
    receiptsRes,
    categoriesRes,
    sourcesRes,
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id, customer_id, occurred_on, is_first_visit, source_id")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .is("voided_at", null),
    supabase
      .from("sales")
      .select("id")
      .gte("occurred_on", prevFrom)
      .lte("occurred_on", prevTo)
      .is("voided_at", null),
    supabase
      .from("sale_items")
      .select(
        "sale_id, category_id, treatment_id, product_id, service_id, line_total, list_price, quantity, discount, treatments(unit_type), sales!inner(occurred_on, voided_at)"
      )
      .gte("sales.occurred_on", from)
      .lte("sales.occurred_on", to)
      .is("sales.voided_at", null),
    supabase
      .from("sale_items")
      .select("line_total, sales!inner(occurred_on, voided_at)")
      .gte("sales.occurred_on", prevFrom)
      .lte("sales.occurred_on", prevTo)
      .is("sales.voided_at", null),
    supabase
      .from("payment_receipts")
      .select("received_on, amount")
      .gte("received_on", from)
      .lte("received_on", to),
    supabase.from("categories").select("id, slug, label"),
    supabase.from("sources").select("id, slug, label"),
  ])

  const catMap = new Map(
    (categoriesRes.data ?? []).map((c) => [
      c.id as string,
      { slug: c.slug as string, label: c.label as string },
    ])
  )
  const sourceMap = new Map(
    (sourcesRes.data ?? []).map((s) => [s.id as string, s.label as string])
  )

  const dayBuckets = new Map<string, WeeklyDayPoint>()
  for (let i = 0; i < 7; i++) {
    const d = shiftDay(from, i)
    dayBuckets.set(d, {
      date: d,
      day: format(parseISO(d), "EEE"),
      sold: 0,
      collected: 0,
    })
  }

  let sold = 0
  let discountsGiven = 0
  let listValue = 0
  const saleTotalMap = new Map<string, number>()
  const categoryAgg = new Map<string, { label: string; revenue: number; saleIds: Set<string> }>()
  const kindAgg = new Map<string, { lines: number; revenue: number }>()

  for (const row of itemsRes.data ?? []) {
    const lineTotal = num(row.line_total)
    const disc = num(row.discount)
    const lv = num(row.list_price) * num(row.quantity)
    const sObj = row.sales as unknown as { occurred_on: string }
    const sid = row.sale_id as string

    sold += lineTotal
    discountsGiven += Math.max(0, disc)
    listValue += lv > 0 ? lv : lineTotal
    saleTotalMap.set(sid, round2((saleTotalMap.get(sid) ?? 0) + lineTotal))

    const bucket = dayBuckets.get(sObj.occurred_on)
    if (bucket) bucket.sold = round2(bucket.sold + lineTotal)

    const catInfo = row.category_id ? catMap.get(row.category_id as string) : undefined
    const catSlug = catInfo?.slug ?? "uncategorised"
    const catLabel = catInfo?.label ?? "Uncategorised"
    const cEntry = categoryAgg.get(catSlug) ?? {
      label: catLabel,
      revenue: 0,
      saleIds: new Set<string>(),
    }
    cEntry.revenue = round2(cEntry.revenue + lineTotal)
    cEntry.saleIds.add(sid)
    categoryAgg.set(catSlug, cEntry)

    let kindLabel = "Other"
    if (row.treatment_id) {
      const tr = row.treatments as unknown as { unit_type: string | null } | null
      if (tr?.unit_type === "package") kindLabel = "Package"
      else if (tr?.unit_type === "membership") kindLabel = "Membership"
      else kindLabel = "Treatment"
    } else if (row.product_id) {
      kindLabel = "Product"
    } else if (row.service_id) {
      kindLabel = "Service"
    }
    const kEntry = kindAgg.get(kindLabel) ?? { lines: 0, revenue: 0 }
    kEntry.lines += 1
    kEntry.revenue = round2(kEntry.revenue + lineTotal)
    kindAgg.set(kindLabel, kEntry)
  }

  const prevSold = round2(
    (prevItemsRes.data ?? []).reduce((sum, r) => sum + num(r.line_total), 0)
  )
  const soldDeltaPct =
    prevSold > 0 ? round2(((sold - prevSold) / prevSold) * 100) : null

  const sales = salesRes.data ?? []
  const prevSalesCount = (prevSalesRes.data ?? []).length
  const avgTicket = sales.length > 0 ? round2(sold / sales.length) : 0
  const prevAvgTicket = prevSalesCount > 0 ? round2(prevSold / prevSalesCount) : 0
  const aovDeltaPct =
    prevAvgTicket > 0 && avgTicket > 0
      ? round2(((avgTicket - prevAvgTicket) / prevAvgTicket) * 100)
      : null

  let collected = 0
  for (const r of receiptsRes.data ?? []) {
    const amt = num(r.amount)
    collected += amt
    const bucket = dayBuckets.get(r.received_on as string)
    if (bucket) bucket.collected = round2(bucket.collected + amt)
  }

  // Group first-visit days so multi-sale day 1 stays "New"
  const firstVisitDays = new Set<string>()
  const allCustomers = new Set<string>()
  const newCustomers = new Set<string>()
  for (const s of sales) {
    const cid = s.customer_id as string
    allCustomers.add(cid)
    if (s.is_first_visit) {
      newCustomers.add(cid)
      firstVisitDays.add(`${cid}:${s.occurred_on as string}`)
    }
  }

  let repeatRevenue = 0
  let totalFirstVisitRevenue = 0
  const channelMap = new Map<string, { newPatients: number; firstVisitRevenue: number }>()

  for (const s of sales) {
    const sid = s.id as string
    const rev = saleTotalMap.get(sid) ?? 0
    const isNewDay = firstVisitDays.has(`${s.customer_id as string}:${s.occurred_on as string}`)
    if (!isNewDay) {
      repeatRevenue += rev
    }
    if (s.is_first_visit) {
      const chName = s.source_id ? sourceMap.get(s.source_id as string) ?? "Direct" : "Direct"
      const ch = channelMap.get(chName) ?? { newPatients: 0, firstVisitRevenue: 0 }
      ch.newPatients += 1
      ch.firstVisitRevenue = round2(ch.firstVisitRevenue + rev)
      totalFirstVisitRevenue += rev
      channelMap.set(chName, ch)
    }
  }

  const newPatients = newCustomers.size
  const repeatPatients = Math.max(0, allCustomers.size - newPatients)
  const repeatRevenuePct = sold > 0 ? round2((repeatRevenue / sold) * 100) : 0
  const discountPct = listValue > 0 ? round2((discountsGiven / listValue) * 100) : 0

  const byCategory: CategoryMixRow[] = Array.from(categoryAgg.entries())
    .map(([slug, v]) => ({
      category: slug,
      label: v.label,
      salesCount: v.saleIds.size,
      revenue: v.revenue,
      avgTicket: v.saleIds.size > 0 ? round2(v.revenue / v.saleIds.size) : 0,
      sharePct: sold > 0 ? round2((v.revenue / sold) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const byKind: KindMixRow[] = Array.from(kindAgg.entries())
    .map(([kind, v]) => ({
      kind,
      lines: v.lines,
      revenue: v.revenue,
      sharePct: sold > 0 ? round2((v.revenue / sold) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const channels: ChannelQualityRow[] = Array.from(channelMap.entries())
    .map(([channel, v]) => ({
      channel,
      newPatients: v.newPatients,
      firstVisitRevenue: v.firstVisitRevenue,
      avgFirstTicket: v.newPatients > 0 ? round2(v.firstVisitRevenue / v.newPatients) : 0,
      sharePct:
        totalFirstVisitRevenue > 0
          ? round2((v.firstVisitRevenue / totalFirstVisitRevenue) * 100)
          : 0,
    }))
    .sort((a, b) => b.firstVisitRevenue - a.firstVisitRevenue)

  return {
    from,
    to,
    sold: round2(sold),
    prevSold,
    soldDeltaPct,
    collected: round2(collected),
    salesCount: sales.length,
    avgTicket,
    aovDeltaPct,
    newPatients,
    repeatPatients,
    repeatRevenuePct,
    discountsGiven: round2(discountsGiven),
    listValue: round2(listValue),
    discountPct,
    dailySeries: Array.from(dayBuckets.values()),
    byCategory,
    byKind,
    channels,
  }
}

// ---------------------------------------------------------------------------
// 3. Monthly Executive Dashboard
// ---------------------------------------------------------------------------

export async function getMonthlyDashboard(targetMonth?: string): Promise<MonthlyDashboardData> {
  const today = clinicToday()
  const currentMonth = `${today.slice(0, 7)}-01`
  const day60Ago = shiftDay(today, -60)
  const day120Ago = shiftDay(today, -120)

  const [
    monthlyMoneyRes,
    monthlyPlRes,
    marketingRes,
    expensePeriodsRes,
    cashForecastRes,
    reactivationRes,
  ] = await Promise.all([
    supabase.from("monthly_money").select("*").order("month", { ascending: true }),
    supabase.from("monthly_pl").select("*").order("month", { ascending: true }),
    supabase.from("marketing_performance").select("*").order("month", { ascending: true }),
    supabase
      .from("expense_periods")
      .select("id, period, status")
      .order("period", { ascending: false }),
    supabase
      .from("cash_expected")
      .select("month, expected, overdue")
      .gte("month", currentMonth)
      .order("month", { ascending: true })
      .limit(4),
    supabase
      .from("customers_overview")
      .select("id, full_name, phone, visits, spent_total, last_visit_on")
      .gt("spent_total", 0)
      .gte("last_visit_on", day120Ago)
      .lte("last_visit_on", day60Ago)
      .order("spent_total", { ascending: false })
      .limit(8),
  ])

  const allMonthsSet = new Set<string>()
  for (const r of monthlyMoneyRes.data ?? []) allMonthsSet.add(r.month as string)
  for (const r of monthlyPlRes.data ?? []) allMonthsSet.add(r.month as string)
  allMonthsSet.add(currentMonth)
  const availableMonths = Array.from(allMonthsSet).sort((a, b) => b.localeCompare(a))

  const selectedMonth =
    targetMonth && /^\d{4}-\d{2}-01$/.test(targetMonth) && allMonthsSet.has(targetMonth)
      ? targetMonth
      : availableMonths[0] ?? currentMonth

  const [y, m] = selectedMonth.split("-").map(Number)
  const selectedMonthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const prevMonthDate = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)

  const trendMonths = Array.from(allMonthsSet).sort().slice(-6)
  const sixMonthStart = trendMonths[0] ?? selectedMonth

  const periodRow = (expensePeriodsRes.data ?? []).find((p) => p.period === selectedMonth)
  const reactivationIds = (reactivationRes.data ?? []).map((c) => c.id as string)

  const [
    catProfitRes,
    itemProfitRes,
    discountRes,
    expenseCatRes,
    expenseEntriesRes,
    receiptsMonthRes,
    stripeReceiptsForecastRes,
    sales6mRes,
    saleLines6mRes,
    lastItemsRes,
  ] = await Promise.all([
    supabase
      .from("profitability_by_category")
      .select("*")
      .eq("month", selectedMonth)
      .order("revenue", { ascending: false }),
    supabase
      .from("item_monthly_profitability")
      .select("*")
      .eq("month", selectedMonth)
      .order("margin", { ascending: false })
      .limit(10),
    supabase.from("discount_by_month").select("*").eq("month", selectedMonth).maybeSingle(),
    supabase
      .from("expense_by_category")
      .select("*")
      .eq("month", selectedMonth)
      .order("amount", { ascending: false }),
    periodRow
      ? supabase
          .from("expense_entries")
          .select("amount, expense_items!inner(normalized_name, cost_behavior)")
          .eq("period_id", periodRow.id as string)
          .is("voided_at", null)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("payment_receipts")
      .select("amount, sale_payments!inner(payment_methods!inner(slug))")
      .gte("received_on", selectedMonth)
      .lte("received_on", selectedMonthEnd),
    supabase
      .from("payment_receipts")
      .select("received_on, amount, sale_payments!inner(payment_methods!inner(slug))")
      .gte("received_on", currentMonth)
      .eq("sale_payments.payment_methods.slug", "stripe"),
    supabase
      .from("sales")
      .select("id, customer_id, occurred_on, is_first_visit")
      .gte("occurred_on", sixMonthStart)
      .is("voided_at", null),
    supabase
      .from("sale_lines")
      .select("sale_id, occurred_on, line_total, voided")
      .gte("occurred_on", sixMonthStart)
      .eq("voided", false),
    reactivationIds.length > 0
      ? supabase
          .from("sale_lines")
          .select("customer_id, item_name, occurred_on")
          .in("customer_id", reactivationIds)
          .eq("voided", false)
          .order("occurred_on", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ customer_id: string; item_name: string }> }),
  ])

  const moneyByMonth = new Map((monthlyMoneyRes.data ?? []).map((r) => [r.month as string, r]))
  const plByMonth = new Map((monthlyPlRes.data ?? []).map((r) => [r.month as string, r]))

  const moneyRow = moneyByMonth.get(selectedMonth)
  const prevMoneyRow = moneyByMonth.get(prevMonthDate)
  const plRow = plByMonth.get(selectedMonth)
  const prevPlRow = plByMonth.get(prevMonthDate)
  const mktRow = (marketingRes.data ?? []).find((r) => r.month === selectedMonth)

  const grossRevenue = num(moneyRow?.gross_revenue ?? plRow?.revenue)
  const returned = num(moneyRow?.returned)
  const adjustmentRevenue = num(moneyRow?.adjustment_revenue)
  const netRevenue = num(moneyRow?.net_revenue ?? grossRevenue)
  const prevNetRevenue = num(prevMoneyRow?.net_revenue ?? prevPlRow?.revenue)
  const netRevenueDeltaPct =
    prevNetRevenue > 0 ? round2(((netRevenue - prevNetRevenue) / prevNetRevenue) * 100) : null

  const collected = num(moneyRow?.collected)
  const cogs = num(plRow?.cogs)
  const revenueWithCost = num(plRow?.revenue_with_cost)
  const grossMargin = num(plRow?.gross_margin)
  const expensesTotal = num(plRow?.expenses)
  const cashResult = round2(netRevenue - expensesTotal)
  const costCoveragePct =
    grossRevenue > 0 ? round2((revenueWithCost / grossRevenue) * 100) : 100
  const grossMarginPct =
    revenueWithCost > 0 ? round2((grossMargin / revenueWithCost) * 100) : null

  const prevRevWithCost = num(prevPlRow?.revenue_with_cost)
  const prevGrossMarginPct =
    prevRevWithCost > 0 ? round2((num(prevPlRow?.gross_margin) / prevRevWithCost) * 100) : null
  const grossMarginDeltaPts =
    grossMarginPct !== null && prevGrossMarginPct !== null
      ? round2(grossMarginPct - prevGrossMarginPct)
      : null

  let adSpendFromEntries = 0
  let marketingConsulting = 0
  let acquisitionTotal = 0
  let recurringFixedExpenses = 0
  let ownerDraw = 0
  let capexExpenses = 0
  for (const e of (expenseEntriesRes.data ?? []) as unknown as Array<{
    amount: unknown
    expense_items: {
      normalized_name: string
      cost_behavior: string | null
    } | null
  }>) {
    const amt = num(e.amount)
    const slug = e.expense_items?.normalized_name ?? ""
    const behavior = e.expense_items?.cost_behavior ?? ""
    if (behavior === "acquisition") {
      acquisitionTotal += amt
      if (slug === "advertising") adSpendFromEntries += amt
      else if (slug === "marketing_consulting") marketingConsulting += amt
    } else if (behavior === "fixed") {
      recurringFixedExpenses += amt
    } else if (behavior === "owner_draw") {
      ownerDraw += amt
    } else if (behavior === "capex") {
      capexExpenses += amt
    }
  }
  const clinicOperatingExpenses = Math.max(0, expensesTotal - ownerDraw - capexExpenses)
  const clinicOperatingProfit = round2(netRevenue - clinicOperatingExpenses)

  const adSpend = round2(adSpendFromEntries)
  const newPatients = num(mktRow?.new_patients)
  const visits = num(mktRow?.visits)
  const repeatVisits = Math.max(0, visits - newPatients)
  const cacAdOnly = newPatients > 0 && adSpend > 0 ? round2(adSpend / newPatients) : null
  const cacBlended =
    newPatients > 0 && acquisitionTotal > 0
      ? round2(acquisitionTotal / newPatients)
      : null
  const roasNew =
    acquisitionTotal > 0
      ? round2(num(mktRow?.revenue_new_patients) / acquisitionTotal)
      : null

  const discountTotal = Math.max(0, num(discountRes.data?.discount))
  const discountListValue = num(discountRes.data?.list_value)
  const discountPct =
    discountListValue > 0 ? round2((discountTotal / discountListValue) * 100) : 0

  // Payment risk mix for selected month
  let instantAmt = 0
  let installmentAmt = 0
  for (const r of (receiptsMonthRes.data ?? []) as unknown as Array<{
    amount: unknown
    sale_payments: { payment_methods: { slug: string } | null } | null
  }>) {
    const amt = num(r.amount)
    if (r.sale_payments?.payment_methods?.slug === "stripe") installmentAmt += amt
    else instantAmt += amt
  }
  const totalPayMix = instantAmt + installmentAmt
  const instantCollectedPct =
    totalPayMix > 0 ? round2((instantAmt / totalPayMix) * 100) : 100
  const installmentRiskPct =
    totalPayMix > 0 ? round2((installmentAmt / totalPayMix) * 100) : 0

  // 6-month trend: group first-visit days by customer_id + occurred_on so multi-sale day 1 stays "New"
  const firstVisitCustomerDays = new Set<string>()
  const saleCustomerDay = new Map<string, string>()
  for (const s of sales6mRes.data ?? []) {
    const key = `${s.customer_id as string}:${s.occurred_on as string}`
    saleCustomerDay.set(s.id as string, key)
    if (s.is_first_visit) firstVisitCustomerDays.add(key)
  }

  const revSplitByMonth = new Map<string, { newRev: number; repeatRev: number }>()
  for (const line of saleLines6mRes.data ?? []) {
    const mKey = `${(line.occurred_on as string).slice(0, 7)}-01`
    const entry = revSplitByMonth.get(mKey) ?? { newRev: 0, repeatRev: 0 }
    const amt = num(line.line_total)
    const cdKey = saleCustomerDay.get(line.sale_id as string)
    if (cdKey && firstVisitCustomerDays.has(cdKey)) entry.newRev += amt
    else entry.repeatRev += amt
    revSplitByMonth.set(mKey, entry)
  }

  const sixMonthTrend: MonthlyTrendPoint[] = trendMonths.map((mk) => {
    const mRow = moneyByMonth.get(mk)
    const pRow = plByMonth.get(mk)
    const split = revSplitByMonth.get(mk) ?? { newRev: 0, repeatRev: 0 }
    return {
      month: mk,
      label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        new Date(`${mk}T12:00:00`)
      ),
      grossRevenue: round2(num(mRow?.gross_revenue ?? pRow?.revenue)),
      netRevenue: round2(num(mRow?.net_revenue ?? pRow?.revenue)),
      collected: round2(num(mRow?.collected)),
      expenses: round2(num(pRow?.expenses)),
      grossMargin: round2(num(pRow?.gross_margin)),
      cashResult: round2(num(pRow?.cash_result)),
      newRevenue: round2(split.newRev),
      repeatRevenue: round2(split.repeatRev),
    }
  })

  const profitabilityByCategory: MonthlyCategoryProfitRow[] = (
    catProfitRes.data ?? []
  ).map((r) => ({
    category: r.category as string,
    label: r.category_label as string,
    revenue: round2(num(r.revenue)),
    revenueWithCost: round2(num(r.revenue_with_cost)),
    cost: round2(num(r.cost)),
    margin: round2(num(r.margin)),
    marginPct: r.margin_pct === null ? null : num(r.margin_pct),
  }))

  const topItems: MonthlyItemProfitRow[] = (itemProfitRes.data ?? []).map((r) => ({
    itemId: (r.item_id as string) ?? (r.item_name as string),
    itemName: r.item_name as string,
    kind: r.kind as string,
    units: num(r.units),
    revenue: round2(num(r.revenue)),
    cost: round2(num(r.cost)),
    margin: round2(num(r.margin)),
    marginPct: r.margin_pct === null ? null : num(r.margin_pct),
    costKnown: Boolean(r.cost_known),
  }))

  const expensesByCategory: ExpenseSliceRow[] = (expenseCatRes.data ?? []).map((r) => {
    const amt = round2(num(r.amount))
    return {
      category: r.category as string,
      label: r.label as string,
      amount: amt,
      sharePct: expensesTotal > 0 ? round2((amt / expensesTotal) * 100) : 0,
    }
  })

  // Stripe-only receipts per upcoming month (no mixing with Cash/Card/Zelle)
  const stripeCollectedByMonth = new Map<string, number>()
  for (const r of (stripeReceiptsForecastRes.data ?? []) as unknown as Array<{
    received_on: string
    amount: unknown
  }>) {
    const mk = `${r.received_on.slice(0, 7)}-01`
    stripeCollectedByMonth.set(mk, round2((stripeCollectedByMonth.get(mk) ?? 0) + num(r.amount)))
  }

  const stripeForecast: StripeForecastRow[] = (cashForecastRes.data ?? []).map((r) => {
    const mk = r.month as string
    return {
      month: mk,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
      }).format(new Date(`${mk}T12:00:00`)),
      expected: round2(num(r.expected)),
      overdue: round2(num(r.overdue)),
      stripeCollected: round2(stripeCollectedByMonth.get(mk) ?? 0),
    }
  })

  // Reactivation watchlist with last treatment context
  const lastItemByCustomer = new Map<string, string>()
  for (const line of (lastItemsRes.data ?? []) as Array<{
    customer_id: string
    item_name: string
  }>) {
    if (!lastItemByCustomer.has(line.customer_id)) {
      lastItemByCustomer.set(line.customer_id, line.item_name)
    }
  }

  const todayMs = parseISO(today).getTime()
  const reactivationWatchlist: ReactivationRow[] = (reactivationRes.data ?? []).map((c) => {
    const last = c.last_visit_on as string
    return {
      id: c.id as string,
      name: c.full_name as string,
      phone: (c.phone as string | null) ?? null,
      visits: num(c.visits),
      spentTotal: round2(num(c.spent_total)),
      lastVisitOn: last,
      daysSinceLastVisit: Math.round((todayMs - parseISO(last).getTime()) / 86_400_000),
      lastItem: lastItemByCustomer.get(c.id as string) ?? null,
    }
  })

  return {
    selectedMonth,
    availableMonths,
    periodStatus: (periodRow?.status as "open" | "closed" | undefined) ?? "none",
    grossRevenue: round2(grossRevenue),
    returned: round2(returned),
    adjustmentRevenue: round2(adjustmentRevenue),
    netRevenue: round2(netRevenue),
    netRevenueDeltaPct,
    collected: round2(collected),
    cogs: round2(cogs),
    revenueWithCost: round2(revenueWithCost),
    costCoveragePct,
    grossMargin: round2(grossMargin),
    grossMarginPct,
    grossMarginDeltaPts,
    expensesTotal: round2(expensesTotal),
    recurringFixedExpenses: round2(recurringFixedExpenses),
    ownerDraw: round2(ownerDraw),
    capexExpenses: round2(capexExpenses),
    clinicOperatingProfit,
    cashResult: round2(cashResult),
    adSpend: round2(adSpend),
    marketingConsulting: round2(marketingConsulting),
    newPatients,
    repeatVisits,
    cacAdOnly,
    cacBlended,
    roasNew,
    discountTotal: round2(discountTotal),
    discountListValue: round2(discountListValue),
    discountPct,
    instantCollectedPct,
    installmentRiskPct,
    sixMonthTrend,
    profitabilityByCategory,
    topItems,
    expensesByCategory,
    stripeForecast,
    reactivationWatchlist,
  }
}
