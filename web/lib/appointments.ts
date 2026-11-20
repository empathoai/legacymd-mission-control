import "server-only"

import { supabase } from "@/lib/supabase/server"
import { clinicToday } from "@/lib/dates"
import { pageWindow } from "@/lib/pagination"

export const APPOINTMENTS_PER_PAGE = 20

export type AppointmentStatus = "booked" | "show_up" | "no_show" | "cancelled"

export type AppointmentOption = { id: string; label: string }

export type AgendaRow = {
  id: string
  scheduledAt: string
  scheduledOn: string
  slotLabel: string
  slotValue: string
  dayLabel: string
  isToday: boolean
  isLate: boolean
  patientId: string | null
  patientName: string
  categoryLabel: string
  sourceLabel: string
  via: "bot" | "desk"
}

export type HistoryRow = {
  id: string
  scheduledAt: string
  scheduledOn: string
  slotLabel: string
  dayLabel: string
  patientId: string | null
  patientName: string
  categoryLabel: string
  sourceLabel: string
  via: "bot" | "desk"
  status: AppointmentStatus
  cancelReason: string | null
  resolvedBy: string | null
}

export type AppointmentPage = {
  rows: HistoryRow[]
  total: number
  page: number
  pageCount: number
}

type Joined<T> = T | T[] | null

function one<T>(value: Joined<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const slotFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

const slotValueFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
})

function slotLabel(value: string): string {
  return slotFormat.format(new Date(value))
}

function dayLabel(value: string): string {
  return dayFormat.format(new Date(value))
}

type RawRow = {
  id: string
  scheduled_at: string
  scheduled_on: string
  status: AppointmentStatus
  external_ref: string | null
  cancel_reason: string | null
  resolved_by: string | null
  customers: Joined<{ id: string; full_name: string }>
  categories: Joined<{ label: string }>
  sources: Joined<{ label: string }>
}

async function normalizedTerm(search?: string): Promise<string | null> {
  const term = search?.trim()
  if (!term) return null

  const { data } = await supabase.rpc("normalize_person_name", { p_name: term })
  return (data as string | null) ?? null
}

function selectEmbed(search: string | null): string {
  const customer = search ? "customers!inner ( id, full_name )" : "customers ( id, full_name )"
  return `id, scheduled_at, scheduled_on, status, external_ref, cancel_reason, resolved_by, ${customer}, categories ( label ), sources ( label )`
}

function baseOf(row: RawRow) {
  const patient = one(row.customers)
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    scheduledOn: row.scheduled_on,
    slotLabel: slotLabel(row.scheduled_at),
    slotValue: slotValueFormat.format(new Date(row.scheduled_at)),
    dayLabel: dayLabel(row.scheduled_at),
    patientId: patient?.id ?? null,
    patientName: patient?.full_name ?? "(unknown)",
    categoryLabel: one(row.categories)?.label ?? "—",
    sourceLabel: one(row.sources)?.label ?? "—",
    via: (row.external_ref ? "bot" : "desk") as "bot" | "desk",
  }
}

/**
 * Everything still `booked`, ascending. No date window: a slot that passed
 * unmarked has to stay in front of the desk until somebody resolves it, or it
 * sinks under the day and nobody ever marks it.
 */
export async function listAgenda(search?: string): Promise<AgendaRow[]> {
  const term = await normalizedTerm(search)

  let query = supabase
    .from("appointments")
    .select(selectEmbed(term))
    .eq("status", "booked")
    .order("scheduled_at", { ascending: true })

  if (term) {
    query = query.ilike("customers.normalized_name", `%${term}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`agenda query failed: ${error.message}`)

  const today = clinicToday()
  const now = Date.now()

  return (data as unknown as RawRow[]).map((row) => {
    const base = baseOf(row)
    return {
      ...base,
      isToday: base.scheduledOn === today,
      isLate: new Date(base.scheduledAt).getTime() < now,
    }
  })
}

export async function listHistory(
  page = 1,
  filter?: { date?: string; from?: string; to?: string },
  search?: string
): Promise<AppointmentPage> {
  const term = await normalizedTerm(search)

  const window = await pageWindow(
    () => {
      const columns: string = term ? "id, customers!inner ( id )" : "id"
      let countQuery = supabase
        .from("appointments")
        .select(columns, {
          count: "exact",
          head: true,
        })
        .neq("status", "booked")

      if (filter?.date) countQuery = countQuery.eq("scheduled_on", filter.date)
      if (filter?.from) countQuery = countQuery.gte("scheduled_on", filter.from)
      if (filter?.to) countQuery = countQuery.lte("scheduled_on", filter.to)
      if (term) countQuery = countQuery.ilike("customers.normalized_name", `%${term}%`)

      return countQuery
    },
    page,
    APPOINTMENTS_PER_PAGE,
    "appointment history query failed"
  )

  let query = supabase
    .from("appointments")
    .select(selectEmbed(term))
    .neq("status", "booked")

  if (filter?.date) query = query.eq("scheduled_on", filter.date)
  if (filter?.from) query = query.gte("scheduled_on", filter.from)
  if (filter?.to) query = query.lte("scheduled_on", filter.to)
  if (term) query = query.ilike("customers.normalized_name", `%${term}%`)

  const { data, error } = await query
    .order("scheduled_at", { ascending: false })
    .range(window.start, window.end)

  if (error) throw new Error(`appointment history query failed: ${error.message}`)

  return {
    rows: (data as unknown as RawRow[]).map((row) => ({
      ...baseOf(row),
      status: row.status,
      cancelReason: row.cancel_reason,
      resolvedBy: row.resolved_by,
    })),
    total: window.total,
    page: window.page,
    pageCount: window.pageCount,
  }
}

export async function listAppointmentOptions(): Promise<{
  categories: AppointmentOption[]
  sources: AppointmentOption[]
}> {
  const [categories, sources] = await Promise.all([
    supabase.from("categories").select("id, label").order("label"),
    supabase.from("sources").select("id, label").order("label"),
  ])

  if (categories.error) throw new Error(`category query failed: ${categories.error.message}`)
  if (sources.error) throw new Error(`source query failed: ${sources.error.message}`)

  return {
    categories: (categories.data ?? []).map((row) => ({
      id: row.id as string,
      label: row.label as string,
    })),
    sources: (sources.data ?? []).map((row) => ({
      id: row.id as string,
      label: row.label as string,
    })),
  }
}

export async function getAgendaCount(): Promise<number> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "booked")

  if (error) throw new Error(`agenda count failed: ${error.message}`)
  return count ?? 0
}
