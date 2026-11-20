import "server-only"

import { clinicToday } from "@/lib/dates"
import { supabase } from "@/lib/supabase/server"

export type DashboardMetrics = {
  month: string
  sold: number
  collected: number
  owed: number
  newPatients: number
  resolvedAppointments: number
  showUpRate: number | null
  comingToday: number
}

function num(value: unknown): number {
  return Number(value ?? 0)
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const today = clinicToday()
  const month = `${today.slice(0, 7)}-01`

  const [pl, cash, balances, appointments, newPatients, coming] = await Promise.all([
    supabase.from("monthly_pl").select("revenue").eq("month", month).maybeSingle(),
    supabase.from("cash_collected").select("collected").eq("month", month).maybeSingle(),
    supabase.from("customer_balances").select("balance"),
    supabase
      .from("appointments")
      .select("status")
      .gte("scheduled_on", month)
      .lte("scheduled_on", today),
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("is_first_visit", true)
      .gte("occurred_on", month)
      .lte("occurred_on", today),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_on", today)
      .eq("status", "booked"),
  ])

  const owed = (balances.data ?? []).reduce((total, row) => total + Math.max(num(row.balance), 0), 0)

  const statuses = (appointments.data ?? []).map((row) => row.status as string)
  const showUps = statuses.filter((status) => status === "show_up").length
  const noShows = statuses.filter((status) => status === "no_show").length
  const resolved = showUps + noShows

  return {
    month,
    sold: num(pl.data?.revenue),
    collected: num(cash.data?.collected),
    owed: Math.round(owed * 100) / 100,
    newPatients: newPatients.count ?? 0,
    resolvedAppointments: resolved,
    showUpRate: resolved === 0 ? null : showUps / resolved,
    comingToday: coming.count ?? 0,
  }
}
