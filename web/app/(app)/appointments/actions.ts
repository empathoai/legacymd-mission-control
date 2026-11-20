"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"
import { actor } from "@/lib/auth"
import { listCustomers } from "@/lib/customers"
import { createCustomer } from "@/app/(app)/patients/actions"


export type ActionResult = { ok: true } | { ok: false; error: string }
export type BookResult = { ok: true; id: string } | { ok: false; error: string }

export type AppointmentCustomer = {
  id: string
  fullName: string
  phone: string | null
  visits: number
  balance: number
}

export type BookAppointmentInput = {
  customerId: string | null
  name: string
  phone: string | null
  birthDate: string | null
  scheduledAt: string
  categoryId: string
  sourceId: string
}

function revalidate(id?: string) {
  revalidatePath("/appointments")
  if (id) revalidatePath(`/patients/${id}`)
}

// The database speaks in ids and constraint names; the desk should not read them.
function readable(message: string): string {
  if (message.includes("already resolved")) {
    return "Another tab already marked this booking. Refresh to see it."
  }
  if (message.includes("resolved booking cannot")) {
    return "A marked booking cannot change. Refresh the page."
  }
  if (message.includes("cannot be moved into the past")) {
    return "A booking cannot be moved into the past."
  }
  if (message.includes("reason of at least 4")) {
    return "A reason of at least 4 characters is required."
  }
  return message
}

export async function bookAppointment(
  input: BookAppointmentInput
): Promise<BookResult> {
  if (!input.scheduledAt) return { ok: false, error: "Pick a day and a time." }
  if (!input.categoryId) return { ok: false, error: "Pick the expected service." }
  if (!input.sourceId) return { ok: false, error: "Pick the channel." }

  let customerId = input.customerId

  if (!customerId) {
    // The same door the sale screen uses: it validates the phone and tells apart
    // a new patient from one already in the master.
    const created = await createCustomer({
      name: input.name,
      phone: input.phone,
      birthDate: input.birthDate,
    })

    if (created.ok) {
      customerId = created.id
    } else if (created.existing) {
      // Booking someone who already exists is the normal case, not an error.
      customerId = created.existing.id
    } else {
      return { ok: false, error: created.error }
    }
  }

  const { data, error } = await supabase.rpc("book_appointment", {
    p_customer_id: customerId,
    p_scheduled_at: input.scheduledAt,
    p_category_id: input.categoryId,
    p_source_id: input.sourceId,
    p_by: await actor(),
  })

  if (error) return { ok: false, error: error.message }

  revalidate(customerId)
  return { ok: true, id: data as string }
}

export async function resolveAppointmentAction(
  id: string,
  status: "show_up" | "no_show" | "cancelled",
  reason?: string
): Promise<ActionResult> {
  const { error } = await supabase.rpc("resolve_appointment", {
    p_id: id,
    p_status: status,
    p_by: await actor(),
    p_reason: reason?.trim() || null,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate()
  return { ok: true }
}

export async function rescheduleAppointmentAction(
  id: string,
  scheduledAt: string,
  reason: string
): Promise<ActionResult> {
  if (!scheduledAt) return { ok: false, error: "Pick the new day and time." }

  const { error } = await supabase.rpc("reschedule_appointment", {
    p_id: id,
    p_new_at: scheduledAt,
    p_by: await actor(),
    p_reason: reason,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate()
  return { ok: true }
}

export async function searchAppointmentCustomers(
  query: string
): Promise<AppointmentCustomer[]> {
  const term = query.trim()
  if (!term) return []

  const rows = await listCustomers(term)

  return rows.slice(0, 8).map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    visits: row.visits,
    balance: row.balance,
  }))
}
