"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"
import { actor } from "@/lib/auth"
import { listCustomers } from "@/lib/customers"

export type SaleLineInput = {
  kind: "treatment" | "product" | "service" | "custom"
  itemId: string | null
  categoryId: string | null
  description: string | null
  quantity: number
  unitPrice: number
}

export type SalePaymentInput = {
  methodId: string
  dueOn: string
  amount: number
  collected: number
}

export type CreateSaleInput = {
  customerId: string
  occurredOn: string
  sourceId: string | null
  appointmentId: string | null
  notes: string | null
  lines: SaleLineInput[]
  payments: SalePaymentInput[]
}

export type CreateSaleResult =
  | { ok: true; saleId: string }
  | { ok: false; error: string }


export async function createSale(
  input: CreateSaleInput
): Promise<CreateSaleResult> {
  if (!input.customerId) return { ok: false, error: "A patient is required." }
  if (!input.occurredOn) return { ok: false, error: "A date is required." }
  if (input.lines.length === 0) return { ok: false, error: "Add at least one line." }
  if (input.payments.length === 0) {
    return { ok: false, error: "Add at least one payment." }
  }

  const { data, error } = await supabase.rpc("create_sale", {
    p_customer_id: input.customerId,
    p_occurred_on: input.occurredOn,
    p_billed_at: null,
    p_source_id: input.sourceId,
    p_appointment_id: input.appointmentId,
    p_notes: input.notes,
    p_by: await actor(),
    p_lines: input.lines.map((line) => ({
      kind: line.kind,
      item_id: line.itemId,
      category_id: line.categoryId,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    })),
    p_payments: input.payments.map((payment) => ({
      method_id: payment.methodId,
      due_on: payment.dueOn,
      amount: payment.amount,
      collected: payment.collected,
    })),
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/sales/details")
  revalidatePath("/sales/report")
  revalidatePath("/patients/report")
  revalidatePath("/", "layout")

  return { ok: true, saleId: data as string }
}

export type SaleCustomerMatch = {
  id: string
  fullName: string
  phone: string | null
  visits: number
  balance: number
  lastVisitOn: string | null
}

export async function searchSaleCustomers(
  query: string
): Promise<SaleCustomerMatch[]> {
  const term = query.trim()
  if (!term) return []

  const rows = await listCustomers(term)

  return rows.slice(0, 8).map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    visits: row.visits,
    balance: row.balance,
    lastVisitOn: row.lastVisitOn,
  }))
}

export type BookedAppointment = {
  id: string
  scheduledOn: string
  scheduledAt: string
}

export async function listBookedAppointments(
  customerId: string
): Promise<BookedAppointment[]> {
  if (!customerId) return []

  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_on, scheduled_at")
    .eq("customer_id", customerId)
    .eq("status", "booked")
    .order("scheduled_at")

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id as string,
    scheduledOn: row.scheduled_on as string,
    scheduledAt: row.scheduled_at as string,
  }))
}
