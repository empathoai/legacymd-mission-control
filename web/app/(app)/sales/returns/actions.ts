"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"
import { actor } from "@/lib/auth"


export type ActionResult = { ok: true } | { ok: false; error: string }

function readable(message: string): string {
  if (message.includes("exceeds")) {
    return "That is more than what was collected and not yet returned."
  }
  if (message.includes("already settled")) {
    return "That return is already settled."
  }
  if (message.includes("receipts or returns")) {
    return "That sale already has money or a return. Record a return instead of voiding it."
  }
  if (message.includes("already voided")) {
    return "That sale is already voided."
  }
  if (message.includes("reason of at least 4")) {
    return "A reason of at least 4 characters is required."
  }
  return message
}

function revalidate() {
  revalidatePath("/sales/returns")
  revalidatePath("/sales/details")
  revalidatePath("/patients/report")
}

export type RecordReturnInput = {
  saleId: string
  amount: number
  methodId: string
  on: string
  kind: "refund" | "chargeback"
  reason: string
}

export async function recordReturn(input: RecordReturnInput): Promise<ActionResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "A return has to be more than zero." }
  }
  if (!input.methodId) {
    return { ok: false, error: "Pick the method the money goes back through." }
  }
  if (!input.on) {
    return { ok: false, error: "Pick the day the return is recorded." }
  }
  if (input.reason.trim().length < 4) {
    return { ok: false, error: "A reason of at least 4 characters is required." }
  }

  const { error } = await supabase.rpc("register_return", {
    p_sale_id: input.saleId,
    p_amount: input.amount,
    p_method_id: input.methodId,
    p_on: input.on,
    p_kind: input.kind,
    p_reason: input.reason.trim(),
    p_by: await actor(),
    p_external_id: null,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate()
  return { ok: true }
}

export async function settleReturnAction(id: string, on: string): Promise<ActionResult> {
  if (!on) return { ok: false, error: "Pick the day the money left." }

  const { error } = await supabase.rpc("settle_return", {
    p_id: id,
    p_on: on,
    p_external_id: null,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate()
  return { ok: true }
}

export async function voidSaleAction(saleId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 4) {
    return { ok: false, error: "A reason of at least 4 characters is required." }
  }

  const { error } = await supabase.rpc("void_sale", {
    p_sale_id: saleId,
    p_by: await actor(),
    p_reason: reason.trim(),
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate()
  return { ok: true }
}
