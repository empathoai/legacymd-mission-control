import "server-only"

import { clinicToday } from "@/lib/dates"
import { supabase } from "@/lib/supabase/server"

export type VipTier = "platinum" | "gold" | "silver"

export type VipPatientRow = {
  id: string
  fullName: string
  phone: string | null
  tier: VipTier
  spentTotal: number
  visits: number
  lastVisitOn: string | null
  daysSinceLastVisit: number | null
  atRisk: boolean
  hasPackageOrMembership: boolean
  categories: string[]
  lastItem: string | null
  sourceLabel: string | null
}

export type RecallPatientRow = {
  id: string
  fullName: string
  phone: string | null
  tier: VipTier | null
  spentTotal: number
  visits: number
  lastVisitOn: string
  daysSinceLastVisit: number
  lastItem: string | null
  lastCategory: string | null
}

export type UpsellReason = "package_upgrade" | "cross_vertical"

export type UpsellPatientRow = {
  id: string
  fullName: string
  phone: string | null
  tier: VipTier | null
  spentTotal: number
  visits: number
  lastVisitOn: string | null
  daysSinceLastVisit: number | null
  reason: UpsellReason
  signalLabel: string
  recommendedOffer: string
  categories: string[]
  lastItem: string | null
}

export type WatchlistPatientRow = {
  id: string
  fullName: string
  phone: string | null
  spentTotal: number
  lastVisitOn: string
  daysSinceLastVisit: number
  firstItem: string | null
  category: string | null
  sourceLabel: string | null
}

export type PatientFrequencyCohort = {
  key: "one" | "returning" | "loyal"
  label: string
  patients: number
  patientPct: number
  revenue: number
  revenuePct: number
}

export type PatientIntelligenceData = {
  summary: {
    totalPatients: number
    repeatPatients: number
    repeatRatePct: number
    vipCount: number
    vipAtRiskCount: number
    vipCashSharePct: number
    upsellCount: number
    recallCount: number
    recallLtvAtRisk: number
    watchlistCount: number
  }
  cohorts: PatientFrequencyCohort[]
  allCategories: string[]
  tierById: Record<string, VipTier>
  vips: VipPatientRow[]
  recall: RecallPatientRow[]
  upsell: UpsellPatientRow[]
  watchlist: WatchlistPatientRow[]
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime()
  const b = new Date(`${toIso}T12:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

function computeTier(spentTotal: number, visits: number, isOverdue: boolean): VipTier | null {
  if (isOverdue) return null
  if (spentTotal >= 3000 || (spentTotal >= 2000 && visits >= 4)) return "platinum"
  if (spentTotal >= 1500 || (spentTotal >= 1000 && visits >= 3)) return "gold"
  if (spentTotal >= 750 || visits >= 2) return "silver"
  return null
}

function suggestComplementaryPillar(onlyCategorySlug: string | null): string {
  if (!onlyCategorySlug) return "Complementary clinical protocol"
  const s = onlyCategorySlug.toLowerCase()
  if (s.includes("weight") || s.includes("metabol")) {
    return "Add Aesthetics / Performance IV continuity"
  }
  if (s.includes("aesthet") || s.includes("facial")) {
    return "Add Longevity / IV Performance protocol"
  }
  if (s.includes("men") || s.includes("hormon")) {
    return "Add Performance / Metabolic optimization"
  }
  return "Add Aesthetics or Longevity evaluation"
}

export async function getPatientIntelligence(): Promise<PatientIntelligenceData> {
  const today = clinicToday()

  const [overviewRes, salesRes, itemsRes, catsRes, sourcesRes, apptsRes] =
    await Promise.all([
      supabase
        .from("customers_overview")
        .select(
          "id, full_name, phone, spent_total, visits, last_visit_on, is_overdue"
        ),
      supabase
        .from("sales")
        .select("id, customer_id, occurred_on, is_first_visit, source_id")
        .is("voided_at", null),
      supabase
        .from("sale_items")
        .select(
          "sale_id, category_id, treatment_id, product_id, service_id, description, treatments(name, unit_type), products(name), services(name), sales!inner(customer_id, occurred_on, voided_at)"
        )
        .is("sales.voided_at", null),
      supabase.from("categories").select("id, slug, label"),
      supabase.from("sources").select("id, label"),
      supabase
        .from("appointments")
        .select("customer_id, scheduled_on")
        .eq("status", "booked")
        .gte("scheduled_on", today),
    ])

  const catMap = new Map(
    (catsRes.data ?? []).map((c) => [
      c.id as string,
      { slug: (c.slug as string) ?? "", label: (c.label as string) ?? "" },
    ])
  )
  const sourceMap = new Map(
    (sourcesRes.data ?? []).map((s) => [s.id as string, s.label as string])
  )

  const upcomingBookedIds = new Set<string>()
  for (const a of apptsRes.data ?? []) {
    if (a.customer_id) upcomingBookedIds.add(a.customer_id as string)
  }

  // First-visit source per customer
  const firstSourceByCustomer = new Map<string, string>()
  for (const s of salesRes.data ?? []) {
    if (s.is_first_visit && s.customer_id && s.source_id) {
      const label = sourceMap.get(s.source_id as string)
      if (label) firstSourceByCustomer.set(s.customer_id as string, label)
    }
  }

  // Per-customer item & category history
  type CustomerHistory = {
    unitLines: number
    hasPackageOrMembership: boolean
    categories: Map<string, string> // slug -> label
    lastDate: string
    lastItem: string | null
    lastCategory: string | null
  }
  const historyByCustomer = new Map<string, CustomerHistory>()

  for (const row of itemsRes.data ?? []) {
    const sale = row.sales as unknown as {
      customer_id?: string
      occurred_on?: string
    } | null
    const cid = sale?.customer_id
    if (!cid) continue

    const tr = row.treatments as unknown as { name?: string; unit_type?: string } | null
    const pr = row.products as unknown as { name?: string } | null
    const sv = row.services as unknown as { name?: string } | null
    const itemName =
      tr?.name ?? pr?.name ?? sv?.name ?? (row.description as string | null) ?? null

    const hist = historyByCustomer.get(cid) ?? {
      unitLines: 0,
      hasPackageOrMembership: false,
      categories: new Map<string, string>(),
      lastDate: "",
      lastItem: null,
      lastCategory: null,
    }

    if (row.treatment_id) {
      if (tr?.unit_type === "package" || tr?.unit_type === "membership") {
        hist.hasPackageOrMembership = true
      } else {
        hist.unitLines += 1
      }
    }

    const cat = row.category_id ? catMap.get(row.category_id as string) : null
    if (cat && cat.label) {
      hist.categories.set(cat.slug || cat.label, cat.label)
    }

    const occurredOn = sale?.occurred_on ?? ""
    if (occurredOn >= hist.lastDate) {
      hist.lastDate = occurredOn
      if (itemName) hist.lastItem = itemName
      if (cat?.label) hist.lastCategory = cat.label
    }

    historyByCustomer.set(cid, hist)
  }

  const patients = overviewRes.data ?? []
  const totalPatients = patients.length
  let repeatPatients = 0
  let totalCash = 0
  let vipCash = 0

  const cohortBuckets = {
    one: { patients: 0, revenue: 0 },
    returning: { patients: 0, revenue: 0 },
    loyal: { patients: 0, revenue: 0 },
  }
  const seenCategories = new Set<string>()

  const tierById: Record<string, VipTier> = {}
  const vips: VipPatientRow[] = []
  const recall: RecallPatientRow[] = []
  const upsell: UpsellPatientRow[] = []
  const watchlist: WatchlistPatientRow[] = []

  for (const p of patients) {
    const id = p.id as string
    const fullName = (p.full_name as string) ?? "(unknown)"
    const phone = (p.phone as string | null) ?? null
    const spentTotal = num(p.spent_total)
    const visits = num(p.visits)
    const lastVisitOn = (p.last_visit_on as string | null) ?? null
    const isOverdue = Boolean(p.is_overdue)
    const hasBooked = upcomingBookedIds.has(id)

    totalCash += spentTotal
    if (visits >= 2) repeatPatients += 1
    if (visits === 1) {
      cohortBuckets.one.patients += 1
      cohortBuckets.one.revenue += spentTotal
    } else if (visits >= 2 && visits <= 3) {
      cohortBuckets.returning.patients += 1
      cohortBuckets.returning.revenue += spentTotal
    } else if (visits >= 4) {
      cohortBuckets.loyal.patients += 1
      cohortBuckets.loyal.revenue += spentTotal
    }

    const daysSince = lastVisitOn ? daysBetween(lastVisitOn, today) : null
    const tier = computeTier(spentTotal, visits, isOverdue)
    if (tier) tierById[id] = tier

    const hist = historyByCustomer.get(id)
    const categories = hist ? Array.from(hist.categories.values()) : []
    for (const c of categories) seenCategories.add(c)
    const onlyCatSlug =
      hist && hist.categories.size === 1
        ? Array.from(hist.categories.keys())[0]
        : null
    const hasPlan = hist?.hasPackageOrMembership ?? false
    const lastItem = hist?.lastItem ?? null
    const lastCategory = hist?.lastCategory ?? categories[0] ?? null
    const sourceLabel = firstSourceByCustomer.get(id) ?? null

    if (tier) {
      if (tier === "platinum" || tier === "gold") vipCash += spentTotal
      const atRisk =
        (tier === "platinum" || tier === "gold") &&
        daysSince !== null &&
        daysSince >= 60 &&
        !hasBooked

      vips.push({
        id,
        fullName,
        phone,
        tier,
        spentTotal,
        visits,
        lastVisitOn,
        daysSinceLastVisit: daysSince,
        atRisk,
        hasPackageOrMembership: hasPlan,
        categories,
        lastItem,
        sourceLabel,
      })
    }

    // Outreach queues auto-suppress overdue and already-booked patients
    if (!isOverdue && !hasBooked) {
      // 1. Recall 60-120d
      if (
        visits >= 1 &&
        spentTotal > 0 &&
        lastVisitOn &&
        daysSince !== null &&
        daysSince >= 60 &&
        daysSince <= 120
      ) {
        recall.push({
          id,
          fullName,
          phone,
          tier,
          spentTotal,
          visits,
          lastVisitOn,
          daysSinceLastVisit: daysSince,
          lastItem,
          lastCategory,
        })
      }

      // 2. Upsell & Cross-Category Gaps
      const unitLines = hist?.unitLines ?? 0
      if (unitLines >= 2 && !hasPlan) {
        upsell.push({
          id,
          fullName,
          phone,
          tier,
          spentTotal,
          visits,
          lastVisitOn,
          daysSinceLastVisit: daysSince,
          reason: "package_upgrade",
          signalLabel: `${unitLines} single sessions · 0 packages`,
          recommendedOffer: "Prepaid continuity package / phased plan",
          categories,
          lastItem,
        })
      } else if (spentTotal >= 500 && categories.length === 1) {
        upsell.push({
          id,
          fullName,
          phone,
          tier,
          spentTotal,
          visits,
          lastVisitOn,
          daysSinceLastVisit: daysSince,
          reason: "cross_vertical",
          signalLabel: `${categories[0]} only (${visits} visit${visits === 1 ? "" : "s"})`,
          recommendedOffer: suggestComplementaryPillar(onlyCatSlug),
          categories,
          lastItem,
        })
      }

      // 3. Single-Visit Watchlist (14-60d)
      if (
        visits === 1 &&
        lastVisitOn &&
        daysSince !== null &&
        daysSince >= 14 &&
        daysSince <= 60
      ) {
        watchlist.push({
          id,
          fullName,
          phone,
          spentTotal,
          lastVisitOn,
          daysSinceLastVisit: daysSince,
          firstItem: lastItem,
          category: lastCategory,
          sourceLabel,
        })
      }
    }
  }

  vips.sort((a, b) => b.spentTotal - a.spentTotal)
  recall.sort((a, b) => b.spentTotal - a.spentTotal)
  upsell.sort((a, b) => b.spentTotal - a.spentTotal)
  watchlist.sort((a, b) => b.spentTotal - a.spentTotal)

  const topVipsCount = vips.filter(
    (v) => v.tier === "platinum" || v.tier === "gold"
  ).length
  const vipAtRiskCount = vips.filter((v) => v.atRisk).length
  const recallLtvAtRisk = recall.reduce((s, r) => s + r.spentTotal, 0)

  const activeVisitedCount =
    cohortBuckets.one.patients +
    cohortBuckets.returning.patients +
    cohortBuckets.loyal.patients
  const cohorts: PatientFrequencyCohort[] = [
    {
      key: "one",
      label: "1 Visit (One-time)",
      patients: cohortBuckets.one.patients,
      patientPct:
        activeVisitedCount > 0
          ? round1((cohortBuckets.one.patients / activeVisitedCount) * 100)
          : 0,
      revenue: Math.round(cohortBuckets.one.revenue * 100) / 100,
      revenuePct:
        totalCash > 0 ? round1((cohortBuckets.one.revenue / totalCash) * 100) : 0,
    },
    {
      key: "returning",
      label: "2–3 Visits (Returning)",
      patients: cohortBuckets.returning.patients,
      patientPct:
        activeVisitedCount > 0
          ? round1((cohortBuckets.returning.patients / activeVisitedCount) * 100)
          : 0,
      revenue: Math.round(cohortBuckets.returning.revenue * 100) / 100,
      revenuePct:
        totalCash > 0
          ? round1((cohortBuckets.returning.revenue / totalCash) * 100)
          : 0,
    },
    {
      key: "loyal",
      label: "4+ Visits (Loyal VIP)",
      patients: cohortBuckets.loyal.patients,
      patientPct:
        activeVisitedCount > 0
          ? round1((cohortBuckets.loyal.patients / activeVisitedCount) * 100)
          : 0,
      revenue: Math.round(cohortBuckets.loyal.revenue * 100) / 100,
      revenuePct:
        totalCash > 0
          ? round1((cohortBuckets.loyal.revenue / totalCash) * 100)
          : 0,
    },
  ]

  return {
    summary: {
      totalPatients,
      repeatPatients,
      repeatRatePct:
        totalPatients > 0 ? round1((repeatPatients / totalPatients) * 100) : 0,
      vipCount: topVipsCount,
      vipAtRiskCount,
      vipCashSharePct: totalCash > 0 ? round1((vipCash / totalCash) * 100) : 0,
      upsellCount: upsell.length,
      recallCount: recall.length,
      recallLtvAtRisk,
      watchlistCount: watchlist.length,
    },
    cohorts,
    allCategories: Array.from(seenCategories).sort(),
    tierById,
    vips,
    recall,
    upsell,
    watchlist,
  }
}
