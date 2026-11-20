import { createHash, timingSafeEqual } from "node:crypto"

import { supabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Json = Record<string, unknown>

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function object(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {}
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

function secretMatches(request: Request, expected: string): boolean {
  const given = request.headers.get("x-ghl-secret") ?? ""
  return timingSafeEqual(digest(given), digest(expected))
}

function reject(status: number, error: string) {
  return Response.json({ error }, { status })
}

/**
 * The bot books in GoHighLevel and GHL pushes the appointment here. It never
 * sends an outcome: the pipeline the clinic moves there is theirs, and the
 * show-up is marked on the agenda.
 */
export async function POST(request: Request) {
  const secret = process.env.GHL_WEBHOOK_SECRET
  if (!secret) {
    console.error("ghl intake: GHL_WEBHOOK_SECRET is not set")
    return reject(500, "The intake is not configured.")
  }
  if (!secretMatches(request, secret)) {
    return reject(401, "Unknown caller.")
  }

  let body: Json
  try {
    body = object(await request.json())
  } catch {
    return reject(422, "The body is not JSON.")
  }

  const calendar = object(body.calendar)
  const appointment = object(body.appointment ?? calendar.appointment ?? body)
  const contact = object(body.contact ?? body.customer)

  const appointmentId = text(
    appointment.id ?? appointment.appointmentId ?? body.appointmentId
  )
  const startTime = text(
    appointment.startTime ?? appointment.start ?? appointment.selectedSlot ?? body.startTime
  )
  const calendarId = text(appointment.calendarId ?? body.calendarId ?? calendar.id)
  const fullName =
    text(contact.fullName ?? contact.name ?? body.fullName ?? body.name) ??
    [text(contact.firstName ?? body.firstName), text(contact.lastName ?? body.lastName)]
      .filter(Boolean)
      .join(" ")
  const phone = text(contact.phone ?? body.phone)

  if (!appointmentId || !startTime || !calendarId) {
    return reject(422, "The delivery has no appointment id, start time or calendar.")
  }
  if (fullName.length < 2) {
    return reject(422, "The delivery has no usable contact name.")
  }

  const startsAt = new Date(startTime)
  if (Number.isNaN(startsAt.getTime())) {
    return reject(422, `The start time "${startTime}" is not a date.`)
  }

  // The map is read before the customer is resolved: an unknown calendar must not
  // leave a person behind in the master.
  const { data: mapping, error: mapError } = await supabase
    .from("ghl_calendar_map")
    .select("category_id, source_id")
    .eq("calendar_id", calendarId)
    .eq("active", true)
    .maybeSingle()

  if (mapError) {
    console.error("ghl intake: map lookup failed", mapError.message)
    return reject(500, "The calendar map could not be read.")
  }
  if (!mapping) {
    console.error(`ghl intake: unmapped calendar ${calendarId}`)
    return reject(422, `Calendar ${calendarId} is not mapped to a category.`)
  }

  const { data: customerId, error: customerError } = await supabase.rpc(
    "resolve_customer",
    { p_name: fullName, p_phone: phone, p_birth: null }
  )

  if (customerError || !customerId) {
    console.error("ghl intake: customer failed", customerError?.message)
    return reject(422, customerError?.message ?? "The customer could not be resolved.")
  }

  const { data: id, error: bookingError } = await supabase.rpc("book_appointment_external", {
    p_customer_id: customerId,
    p_scheduled_at: startsAt.toISOString(),
    p_category_id: mapping.category_id,
    p_source_id: mapping.source_id,
    p_ref: `ghl:${appointmentId}`,
    p_by: "ghl",
  })

  if (bookingError || !id) {
    console.error("ghl intake: booking failed", bookingError?.message)
    return reject(422, bookingError?.message ?? "The booking could not be recorded.")
  }

  return Response.json({ id })
}
