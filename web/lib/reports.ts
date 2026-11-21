import "server-only"

import { supabase } from "@/lib/supabase/server"

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export type SalesTrendGranularity = "month" | "week" | "day" | "none"

export type SalesTrendPoint = {
  bucket: string
  label: string
  sold: number
  collected: number
  newRevenue: number
  repeatRevenue: number
  salesCount: number
  avgTicket: number
}

export type DayOfWeekRow = {
  dow: number
  label: string
  activeDays: number
  salesCount: number
  revenue: number
  avgDailyRevenue: number
  avgTicket: number
  sharePct: number
}

export type TopSalesItemRow = {
  itemName: string
  kind: string
  category: string
  units: number
  lines: number
  revenue: number
  sharePct: number
  cumulativePct: number
  discount: number
  discountPct: number
}

export type SalesReportData = {
  sold: number
  collected: number
  collectionRatioPct: number
  listValue: number
  discountTotal: number
  discountPct: number
  salesCount: number
  linesCount: number
  avgLinesPerSale: number
  newSalesCount: number
  repeatSalesCount: number
  newSalesRevenue: number
  repeatSalesRevenue: number
  newAvgTicket: number
  repeatAvgTicket: number
  avgTicket: number
  pareto80Count: number
  top5SharePct: number
  trendGranularity: SalesTrendGranularity
  trend: SalesTrendPoint[]
  byDayOfWeek: DayOfWeekRow[]
  topItems: TopSalesItemRow[]
  byCategory: { label: string; lines: number; revenue: number; sharePct: number }[]
  byKind: { label: string; lines: number; revenue: number; sharePct: number }[]
  byPaymentMethod: { label: string; receipts: number; collected: number; sharePct: number }[]
  bySourceFirstVisit: { label: string; newPatients: number; revenue: number }[]
  topDiscounted: {
    itemName: string
    lines: number
    listValue: number
    discount: number
    discountPct: number
  }[]
}

export async function getSalesReport(filter?: {
  from?: string
  to?: string
}): Promise<SalesReportData> {
  let salesQuery = supabase
    .from("sales")
    .select("id, occurred_on, is_first_visit, source_id")
    .is("voided_at", null)

  let itemsQuery = supabase
    .from("sale_items")
    .select(
      "sale_id, category_id, treatment_id, product_id, service_id, description, quantity, line_total, list_price, discount, treatments(name, unit_type), products(name), services(name), sales!inner(occurred_on, voided_at)"
    )
    .is("sales.voided_at", null)

  let receiptsQuery = supabase
    .from("payment_receipts")
    .select("amount, received_on, sale_payment_id")

  if (filter?.from) {
    salesQuery = salesQuery.gte("occurred_on", filter.from)
    itemsQuery = itemsQuery.gte("sales.occurred_on", filter.from)
    receiptsQuery = receiptsQuery.gte("received_on", filter.from)
  }
  if (filter?.to) {
    salesQuery = salesQuery.lte("occurred_on", filter.to)
    itemsQuery = itemsQuery.lte("sales.occurred_on", filter.to)
    receiptsQuery = receiptsQuery.lte("received_on", filter.to)
  }

  const [salesRes, itemsRes, receiptsRes, paymentsRes, catsRes, sourcesRes, methodsRes] =
    await Promise.all([
      salesQuery,
      itemsQuery,
      receiptsQuery,
      supabase.from("sale_payments").select("id, payment_method_id"),
      supabase.from("categories").select("id, label"),
      supabase.from("sources").select("id, label"),
      supabase.from("payment_methods").select("id, label"),
    ])

  const paymentMethodByPaymentId = new Map(
    (paymentsRes.data ?? []).map((p) => [p.id as string, p.payment_method_id as string])
  )

  const catMap = new Map((catsRes.data ?? []).map((c) => [c.id as string, c.label as string]))
  const sourceMap = new Map((sourcesRes.data ?? []).map((s) => [s.id as string, s.label as string]))
  const methodMap = new Map((methodsRes.data ?? []).map((m) => [m.id as string, m.label as string]))

  let sold = 0
  let listValue = 0
  let discountTotal = 0
  const saleTotalMap = new Map<string, number>()
  const catAgg = new Map<string, { lines: number; revenue: number }>()
  const kindAgg = new Map<string, { lines: number; revenue: number }>()
  const discAgg = new Map<string, { lines: number; listValue: number; discount: number }>()
  const itemAgg = new Map<
    string,
    {
      itemName: string
      kind: string
      category: string
      units: number
      lines: number
      revenue: number
      listValue: number
      discount: number
    }
  >()

  const items = itemsRes.data ?? []
  for (const row of items) {
    const rev = num(row.line_total)
    const qty = Math.max(1, num(row.quantity))
    const disc = Math.max(0, num(row.discount))
    const lv = num(row.list_price) * num(row.quantity)
    const safeLv = lv > 0 ? lv : rev
    sold += rev
    listValue += safeLv
    discountTotal += disc

    const sid = row.sale_id as string
    saleTotalMap.set(sid, (saleTotalMap.get(sid) ?? 0) + rev)

    const catLabel = row.category_id ? catMap.get(row.category_id as string) ?? "Uncategorised" : "Uncategorised"
    const c = catAgg.get(catLabel) ?? { lines: 0, revenue: 0 }
    c.lines += 1
    c.revenue = round2(c.revenue + rev)
    catAgg.set(catLabel, c)

    const tr = row.treatments as unknown as { name?: string; unit_type?: string } | null
    const pr = row.products as unknown as { name?: string } | null
    const sv = row.services as unknown as { name?: string } | null

    let kindLabel = "Other"
    if (row.treatment_id) {
      if (tr?.unit_type === "package") kindLabel = "Package"
      else if (tr?.unit_type === "membership") kindLabel = "Membership"
      else kindLabel = "Treatment"
    } else if (row.product_id) {
      kindLabel = "Product"
    } else if (row.service_id) {
      kindLabel = "Service"
    }
    const k = kindAgg.get(kindLabel) ?? { lines: 0, revenue: 0 }
    k.lines += 1
    k.revenue = round2(k.revenue + rev)
    kindAgg.set(kindLabel, k)

    const itemName = tr?.name ?? pr?.name ?? sv?.name ?? (row.description as string) ?? "Item"
    const itemKey = `${kindLabel}::${itemName}`
    const it = itemAgg.get(itemKey) ?? {
      itemName,
      kind: kindLabel,
      category: catLabel,
      units: 0,
      lines: 0,
      revenue: 0,
      listValue: 0,
      discount: 0,
    }
    it.units += qty
    it.lines += 1
    it.revenue = round2(it.revenue + rev)
    it.listValue = round2(it.listValue + safeLv)
    it.discount = round2(it.discount + disc)
    itemAgg.set(itemKey, it)

    if (disc > 0.005) {
      const d = discAgg.get(itemName) ?? { lines: 0, listValue: 0, discount: 0 }
      d.lines += 1
      d.listValue = round2(d.listValue + safeLv)
      d.discount = round2(d.discount + disc)
      discAgg.set(itemName, d)
    }
  }

  const sales = salesRes.data ?? []
  let newSalesCount = 0
  let repeatSalesCount = 0
  let newSalesRevenue = 0
  let repeatSalesRevenue = 0
  const sourceAgg = new Map<string, { newPatients: number; revenue: number }>()

  // Determine adaptive trend granularity
  const allDates = sales
    .map((s) => (s.occurred_on as string | null) ?? "")
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
  const spanFrom = filter?.from ?? allDates[0]
  const spanTo = filter?.to ?? allDates[allDates.length - 1]
  let trendGranularity: SalesTrendGranularity = "month"
  if (filter?.from && filter?.to && filter.from === filter.to) {
    trendGranularity = "none"
  } else if (spanFrom && spanTo) {
    const days =
      Math.round(
        (new Date(`${spanTo}T12:00:00`).getTime() -
          new Date(`${spanFrom}T12:00:00`).getTime()) /
          86400000
      ) + 1
    if (days <= 35) trendGranularity = "day"
    else if (days <= 120) trendGranularity = "week"
    else trendGranularity = "month"
  }

  function bucketOf(isoDay: string): { bucket: string; label: string } {
    const dt = new Date(`${isoDay}T12:00:00`)
    if (trendGranularity === "day") {
      return {
        bucket: isoDay,
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(dt),
      }
    }
    if (trendGranularity === "week") {
      const dow = dt.getDay()
      const diffToMon = dow === 0 ? -6 : 1 - dow
      const mon = new Date(dt.getTime() + diffToMon * 86400000)
      const monIso = mon.toISOString().slice(0, 10)
      return {
        bucket: monIso,
        label: `Wk ${new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(mon)}`,
      }
    }
    const ym = isoDay.slice(0, 7)
    return {
      bucket: ym,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
      }).format(new Date(`${ym}-01T12:00:00`)),
    }
  }

  const trendAgg = new Map<
    string,
    {
      label: string
      sold: number
      collected: number
      newRevenue: number
      repeatRevenue: number
      salesCount: number
    }
  >()

  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dowOrder = [1, 2, 3, 4, 5, 6, 0]
  const dowAgg = new Map<
    number,
    { dates: Set<string>; salesCount: number; revenue: number }
  >()
  for (const d of dowOrder) {
    dowAgg.set(d, { dates: new Set(), salesCount: 0, revenue: 0 })
  }

  for (const s of sales) {
    const saleRev = saleTotalMap.get(s.id as string) ?? 0
    const occurredOn = s.occurred_on as string | null

    if (s.is_first_visit) {
      newSalesCount += 1
      newSalesRevenue += saleRev
      const sLabel = s.source_id ? sourceMap.get(s.source_id as string) ?? "Direct" : "Direct"
      const entry = sourceAgg.get(sLabel) ?? { newPatients: 0, revenue: 0 }
      entry.newPatients += 1
      entry.revenue = round2(entry.revenue + saleRev)
      sourceAgg.set(sLabel, entry)
    } else {
      repeatSalesCount += 1
      repeatSalesRevenue += saleRev
    }

    if (occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      const dow = new Date(`${occurredOn}T12:00:00`).getDay()
      const dEntry = dowAgg.get(dow)
      if (dEntry) {
        dEntry.dates.add(occurredOn)
        dEntry.salesCount += 1
        dEntry.revenue = round2(dEntry.revenue + saleRev)
      }

      if (trendGranularity !== "none") {
        const { bucket, label } = bucketOf(occurredOn)
        const t = trendAgg.get(bucket) ?? {
          label,
          sold: 0,
          collected: 0,
          newRevenue: 0,
          repeatRevenue: 0,
          salesCount: 0,
        }
        t.sold = round2(t.sold + saleRev)
        t.salesCount += 1
        if (s.is_first_visit) t.newRevenue = round2(t.newRevenue + saleRev)
        else t.repeatRevenue = round2(t.repeatRevenue + saleRev)
        trendAgg.set(bucket, t)
      }
    }
  }

  let totalCollected = 0
  const payAgg = new Map<string, { receipts: number; collected: number }>()
  for (const r of receiptsRes.data ?? []) {
    const amt = num(r.amount)
    totalCollected += amt
    const pmId = paymentMethodByPaymentId.get(r.sale_payment_id as string)
    const mLabel = pmId ? methodMap.get(pmId) ?? "Other" : "Other"
    const entry = payAgg.get(mLabel) ?? { receipts: 0, collected: 0 }
    entry.receipts += 1
    entry.collected = round2(entry.collected + amt)
    payAgg.set(mLabel, entry)

    const receivedOn = r.received_on as string | null
    if (
      trendGranularity !== "none" &&
      receivedOn &&
      /^\d{4}-\d{2}-\d{2}$/.test(receivedOn)
    ) {
      const { bucket, label } = bucketOf(receivedOn)
      const t = trendAgg.get(bucket) ?? {
        label,
        sold: 0,
        collected: 0,
        newRevenue: 0,
        repeatRevenue: 0,
        salesCount: 0,
      }
      t.collected = round2(t.collected + amt)
      trendAgg.set(bucket, t)
    }
  }

  const sortedItems = Array.from(itemAgg.values()).sort((a, b) => b.revenue - a.revenue)
  let runningRev = 0
  let pareto80Count = 0
  const topItemsAll: TopSalesItemRow[] = sortedItems.map((it, idx) => {
    runningRev += it.revenue
    const sharePct = sold > 0 ? round2((it.revenue / sold) * 100) : 0
    const cumulativePct = sold > 0 ? round2((runningRev / sold) * 100) : 0
    if (pareto80Count === 0 && cumulativePct >= 80) pareto80Count = idx + 1
    return {
      itemName: it.itemName,
      kind: it.kind,
      category: it.category,
      units: it.units,
      lines: it.lines,
      revenue: it.revenue,
      sharePct,
      cumulativePct,
      discount: it.discount,
      discountPct: it.listValue > 0 ? round2((it.discount / it.listValue) * 100) : 0,
    }
  })
  if (pareto80Count === 0 && topItemsAll.length > 0) pareto80Count = topItemsAll.length
  const top5SharePct =
    topItemsAll.length > 0
      ? topItemsAll[Math.min(4, topItemsAll.length - 1)].cumulativePct
      : 0

  const byDayOfWeek: DayOfWeekRow[] = dowOrder
    .map((dow) => {
      const d = dowAgg.get(dow)!
      const activeDays = d.dates.size
      return {
        dow,
        label: dowLabels[dow],
        activeDays,
        salesCount: d.salesCount,
        revenue: d.revenue,
        avgDailyRevenue: activeDays > 0 ? round2(d.revenue / activeDays) : 0,
        avgTicket: d.salesCount > 0 ? round2(d.revenue / d.salesCount) : 0,
        sharePct: sold > 0 ? round2((d.revenue / sold) * 100) : 0,
      }
    })
    .filter((d) => d.dow !== 0 || d.revenue > 0)

  const trend: SalesTrendPoint[] = Array.from(trendAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({
      bucket,
      label: v.label,
      sold: v.sold,
      collected: v.collected,
      newRevenue: v.newRevenue,
      repeatRevenue: v.repeatRevenue,
      salesCount: v.salesCount,
      avgTicket: v.salesCount > 0 ? round2(v.sold / v.salesCount) : 0,
    }))

  return {
    sold: round2(sold),
    collected: round2(totalCollected),
    collectionRatioPct: sold > 0 ? round2((totalCollected / sold) * 100) : 0,
    listValue: round2(listValue),
    discountTotal: round2(discountTotal),
    discountPct: listValue > 0 ? round2((discountTotal / listValue) * 100) : 0,
    salesCount: sales.length,
    linesCount: items.length,
    avgLinesPerSale: sales.length > 0 ? round2(items.length / sales.length) : 0,
    newSalesCount,
    repeatSalesCount,
    newSalesRevenue: round2(newSalesRevenue),
    repeatSalesRevenue: round2(repeatSalesRevenue),
    newAvgTicket: newSalesCount > 0 ? round2(newSalesRevenue / newSalesCount) : 0,
    repeatAvgTicket: repeatSalesCount > 0 ? round2(repeatSalesRevenue / repeatSalesCount) : 0,
    avgTicket: sales.length > 0 ? round2(sold / sales.length) : 0,
    pareto80Count,
    top5SharePct,
    trendGranularity,
    trend,
    byDayOfWeek,
    topItems: topItemsAll.slice(0, 10),
    byCategory: Array.from(catAgg.entries())
      .map(([label, v]) => ({
        label,
        lines: v.lines,
        revenue: v.revenue,
        sharePct: sold > 0 ? round2((v.revenue / sold) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    byKind: Array.from(kindAgg.entries())
      .map(([label, v]) => ({
        label,
        lines: v.lines,
        revenue: v.revenue,
        sharePct: sold > 0 ? round2((v.revenue / sold) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    byPaymentMethod: Array.from(payAgg.entries())
      .map(([label, v]) => ({
        label,
        receipts: v.receipts,
        collected: v.collected,
        sharePct: totalCollected > 0 ? round2((v.collected / totalCollected) * 100) : 0,
      }))
      .sort((a, b) => b.collected - a.collected),
    bySourceFirstVisit: Array.from(sourceAgg.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    topDiscounted: Array.from(discAgg.entries())
      .map(([itemName, v]) => ({
        itemName,
        ...v,
        discountPct: v.listValue > 0 ? round2((v.discount / v.listValue) * 100) : 0,
      }))
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 8),
  }
}

export type BoardMonthRow = {
  month: string
  label: string
  shortLabel: string
  status: "closed" | "open" | "none"
  grossRevenue: number
  returned: number
  adjustmentRevenue: number
  netRevenue: number
  collected: number
  cogs: number
  revenueWithCost: number
  grossMargin: number
  grossMarginPct: number | null
  fixedExpenses: number
  variableExpenses: number
  acquisitionExpenses: number
  adSpend: number
  consultingSpend: number
  clinicOpEx: number
  operatingProfit: number
  ownerDraw: number
  capex: number
  expensesTotal: number
  retainedCash: number
  newPatients: number
  firstVisitRevenue: number
}

export type CategoryMonthRow = {
  month: string
  category: string
  label: string
  lines: number
  revenue: number
  revenueWithCost: number
  cost: number
  margin: number
}

export type ItemMonthRow = {
  month: string
  itemId: string
  itemName: string
  kind: string
  units: number
  revenue: number
  revenueWithCost: number
  cost: number
  margin: number
  costKnown: boolean
}

export type ChannelCohortRow = {
  channel: string
  newPatients: number
  avgFirstTicket: number
  repeatRatePct: number
  realizedLtv: number
}

export type ExecutiveReportData = {
  monthlyBoard: BoardMonthRow[]
  categoryMonthly: CategoryMonthRow[]
  itemMonthly: ItemMonthRow[]
  channelCohorts: ChannelCohortRow[]
}

export async function getExecutiveReport(): Promise<ExecutiveReportData> {
  const [
    moneyRes,
    plRes,
    periodsRes,
    entriesRes,
    catRes,
    itemRes,
    firstSalesRes,
    saleLinesRes,
    sourcesRes,
    customersRes,
  ] = await Promise.all([
    supabase.from("monthly_money").select("*").order("month", { ascending: true }),
    supabase.from("monthly_pl").select("*").order("month", { ascending: true }),
    supabase.from("expense_periods").select("id, period, status"),
    supabase
      .from("expense_entries")
      .select(
        "amount, period_id, expense_items!inner(normalized_name, cost_behavior)"
      )
      .is("voided_at", null),
    supabase
      .from("profitability_by_category")
      .select("*")
      .order("month", { ascending: true }),
    supabase
      .from("item_monthly_profitability")
      .select("*")
      .order("month", { ascending: true }),
    supabase
      .from("sales")
      .select("id, customer_id, occurred_on, source_id")
      .eq("is_first_visit", true)
      .is("voided_at", null),
    supabase
      .from("sale_lines")
      .select("sale_id, line_total, voided")
      .eq("voided", false),
    supabase.from("sources").select("id, label"),
    supabase
      .from("customers_overview")
      .select("id, visits, spent_total")
      .gt("visits", 0),
  ])

  const plByMonth = new Map((plRes.data ?? []).map((r) => [r.month as string, r]))
  const moneyByMonth = new Map((moneyRes.data ?? []).map((r) => [r.month as string, r]))
  const periodById = new Map(
    (periodsRes.data ?? []).map((p) => [
      p.id as string,
      { period: p.period as string, status: p.status as "closed" | "open" },
    ])
  )
  const periodStatusByMonth = new Map(
    (periodsRes.data ?? []).map((p) => [
      p.period as string,
      p.status as "closed" | "open",
    ])
  )

  // Group non-voided expenses by month and cost_behavior
  const expByMonth = new Map<
    string,
    {
      fixed: number
      variable: number
      acquisition: number
      adSpend: number
      consultingSpend: number
      ownerDraw: number
      capex: number
      total: number
    }
  >()

  for (const e of (entriesRes.data ?? []) as unknown as Array<{
    amount: unknown
    period_id: string
    expense_items: { normalized_name: string; cost_behavior: string | null } | null
  }>) {
    const pInfo = periodById.get(e.period_id)
    if (!pInfo) continue
    const mk = pInfo.period
    const bucket = expByMonth.get(mk) ?? {
      fixed: 0,
      variable: 0,
      acquisition: 0,
      adSpend: 0,
      consultingSpend: 0,
      ownerDraw: 0,
      capex: 0,
      total: 0,
    }
    const amt = num(e.amount)
    const behavior = e.expense_items?.cost_behavior ?? "fixed"
    const slug = e.expense_items?.normalized_name ?? ""
    bucket.total = round2(bucket.total + amt)
    if (behavior === "fixed") bucket.fixed = round2(bucket.fixed + amt)
    else if (behavior === "variable") bucket.variable = round2(bucket.variable + amt)
    else if (behavior === "acquisition") {
      bucket.acquisition = round2(bucket.acquisition + amt)
      if (slug === "advertising") bucket.adSpend = round2(bucket.adSpend + amt)
      else if (slug === "marketing_consulting") {
        bucket.consultingSpend = round2(bucket.consultingSpend + amt)
      }
    } else if (behavior === "owner_draw") {
      bucket.ownerDraw = round2(bucket.ownerDraw + amt)
    } else if (behavior === "capex") {
      bucket.capex = round2(bucket.capex + amt)
    }
    expByMonth.set(mk, bucket)
  }

  // Sale totals for first-visit revenue & channel cohorts
  const saleTotalById = new Map<string, number>()
  for (const l of saleLinesRes.data ?? []) {
    const sid = l.sale_id as string
    saleTotalById.set(sid, round2((saleTotalById.get(sid) ?? 0) + num(l.line_total)))
  }

  const sourceMap = new Map(
    (sourcesRes.data ?? []).map((s) => [s.id as string, s.label as string])
  )
  const customerMap = new Map(
    (customersRes.data ?? []).map((c) => [
      c.id as string,
      { visits: num(c.visits), spentTotal: num(c.spent_total) },
    ])
  )

  const acqByMonth = new Map<string, { newPatients: number; firstVisitRev: number }>()
  const channelCohortMap = new Map<
    string,
    { newPatients: number; firstVisitRev: number; repeatCount: number; totalLtv: number }
  >()

  for (const s of firstSalesRes.data ?? []) {
    const mk = `${(s.occurred_on as string).slice(0, 7)}-01`
    const rev = saleTotalById.get(s.id as string) ?? 0
    const mEntry = acqByMonth.get(mk) ?? { newPatients: 0, firstVisitRev: 0 }
    mEntry.newPatients += 1
    mEntry.firstVisitRev = round2(mEntry.firstVisitRev + rev)
    acqByMonth.set(mk, mEntry)

    const chLabel = s.source_id ? sourceMap.get(s.source_id as string) ?? "Direct" : "Direct"
    const cust = customerMap.get(s.customer_id as string)
    const ch = channelCohortMap.get(chLabel) ?? {
      newPatients: 0,
      firstVisitRev: 0,
      repeatCount: 0,
      totalLtv: 0,
    }
    ch.newPatients += 1
    ch.firstVisitRev = round2(ch.firstVisitRev + rev)
    if (cust) {
      if (cust.visits >= 2) ch.repeatCount += 1
      ch.totalLtv = round2(ch.totalLtv + cust.spentTotal)
    }
    channelCohortMap.set(chLabel, ch)
  }

  const months = Array.from(
    new Set([...plByMonth.keys(), ...moneyByMonth.keys(), ...expByMonth.keys()])
  ).sort()

  const monthlyBoard: BoardMonthRow[] = months.map((m) => {
    const mr = moneyByMonth.get(m)
    const pr = plByMonth.get(m)
    const ex = expByMonth.get(m) ?? {
      fixed: 0,
      variable: 0,
      acquisition: 0,
      adSpend: 0,
      consultingSpend: 0,
      ownerDraw: 0,
      capex: 0,
      total: num(pr?.expenses),
    }
    const acq = acqByMonth.get(m) ?? { newPatients: 0, firstVisitRev: 0 }
    const grossRevenue = round2(num(mr?.gross_revenue ?? pr?.revenue))
    const returned = round2(num(mr?.returned))
    const adjustmentRevenue = round2(num(mr?.adjustment_revenue))
    const netRevenue = round2(num(mr?.net_revenue ?? grossRevenue))
    const collected = round2(num(mr?.collected))
    const cogs = round2(num(pr?.cogs))
    const revenueWithCost = round2(num(pr?.revenue_with_cost))
    const grossMargin = round2(num(pr?.gross_margin))
    const grossMarginPct =
      revenueWithCost > 0 ? round2((grossMargin / revenueWithCost) * 100) : null
    const clinicOpEx = round2(ex.fixed + ex.variable + ex.acquisition)
    const operatingProfit = round2(netRevenue - clinicOpEx)
    const retainedCash = round2(netRevenue - ex.total)

    return {
      month: m,
      label: new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(new Date(`${m}T12:00:00`)),
      shortLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        new Date(`${m}T12:00:00`)
      ),
      status: periodStatusByMonth.get(m) ?? "none",
      grossRevenue,
      returned,
      adjustmentRevenue,
      netRevenue,
      collected,
      cogs,
      revenueWithCost,
      grossMargin,
      grossMarginPct,
      fixedExpenses: ex.fixed,
      variableExpenses: ex.variable,
      acquisitionExpenses: ex.acquisition,
      adSpend: ex.adSpend,
      consultingSpend: ex.consultingSpend,
      clinicOpEx,
      operatingProfit,
      ownerDraw: ex.ownerDraw,
      capex: ex.capex,
      expensesTotal: ex.total,
      retainedCash,
      newPatients: acq.newPatients,
      firstVisitRevenue: acq.firstVisitRev,
    }
  })

  const categoryMonthly: CategoryMonthRow[] = (catRes.data ?? []).map((r) => ({
    month: r.month as string,
    category: r.category as string,
    label: r.category_label as string,
    lines: num(r.lines),
    revenue: round2(num(r.revenue)),
    revenueWithCost: round2(num(r.revenue_with_cost)),
    cost: round2(num(r.cost)),
    margin: round2(num(r.margin)),
  }))

  const itemMonthly: ItemMonthRow[] = (itemRes.data ?? []).map((r) => ({
    month: r.month as string,
    itemId: (r.item_id as string) ?? (r.item_name as string),
    itemName: r.item_name as string,
    kind: r.kind as string,
    units: num(r.units),
    revenue: round2(num(r.revenue)),
    revenueWithCost: round2(num(r.revenue_with_cost)),
    cost: round2(num(r.cost)),
    margin: round2(num(r.margin)),
    costKnown: Boolean(r.cost_known),
  }))

  const channelCohorts: ChannelCohortRow[] = Array.from(channelCohortMap.entries())
    .map(([channel, v]) => ({
      channel,
      newPatients: v.newPatients,
      avgFirstTicket: v.newPatients > 0 ? round2(v.firstVisitRev / v.newPatients) : 0,
      repeatRatePct: v.newPatients > 0 ? round2((v.repeatCount / v.newPatients) * 100) : 0,
      realizedLtv: v.newPatients > 0 ? round2(v.totalLtv / v.newPatients) : 0,
    }))
    .sort((a, b) => b.newPatients - a.newPatients)

  return {
    monthlyBoard,
    categoryMonthly,
    itemMonthly,
    channelCohorts,
  }
}
