"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"
import { actor } from "@/lib/auth"


export type ActionResult = { ok: true } | { ok: false; error: string }

function readable(message: string): string {
  if (message.includes("exceeds")) {
    return "That is more than this installment still expects."
  }
  if (message.includes("is void")) {
    return "That installment is cancelled."
  }
  if (message.includes("is voided")) {
    return "The sale is voided: nothing is expected."
  }
  if (message.includes("more than zero")) {
    return "A payment has to be more than zero."
  }
  if (message.includes("already") && message.includes("void")) {
    return "That installment is already cancelled."
  }
  if (message.includes("reason of at least 4")) {
    return "A reason of at least 4 characters is required."
  }
  return message
}

export async function recordPayment(input: {
  installmentId: string
  amount: number
  on: string
  methodId: string
  note: string | null
}): Promise<ActionResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "A payment has to be more than zero." }
  }
  if (!input.methodId) return { ok: false, error: "Pick the method." }
  if (!input.on) return { ok: false, error: "Pick the day the money arrived." }

  const { error } = await supabase.rpc("record_receipt", {
    p_sale_payment_id: input.installmentId,
    p_amount: input.amount,
    p_on: input.on,
    p_method_id: input.methodId,
    p_by: await actor(),
    p_note: input.note?.trim() || null,
    p_external_id: null,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidatePath("/open-items")
  revalidatePath("/patients/report")
  return { ok: true }
}

export async function cancelInstallment(
  installmentId: string,
  reason: string
): Promise<ActionResult> {
  if (reason.trim().length < 4) {
    return { ok: false, error: "A reason of at least 4 characters is required." }
  }

  const { error } = await supabase.rpc("void_payment", {
    p_installment_id: installmentId,
    p_by: await actor(),
    p_reason: reason.trim(),
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidatePath("/open-items")
  revalidatePath("/patients/report")
  return { ok: true }
}
