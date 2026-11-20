"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"
import { actor } from "@/lib/auth"


export type ActionResult = { ok: true } | { ok: false; error: string }

function readable(message: string): string {
  if (message.includes("expense period is closed")) {
    return "This month is closed. Reopen it before editing."
  }
  if (message.includes("does not exist or is already closed")) {
    return "That month is already closed."
  }
  if (message.includes("does not exist or is not closed")) {
    return "That month is already open."
  }
  if (message.includes("already voided")) {
    return "That line is already voided."
  }
  if (message.includes("reason of at least 4")) {
    return "A reason of at least 4 characters is required."
  }
  if (message.includes("first day of its month")) {
    return "A month starts on its first day."
  }
  return message
}

function revalidate(period: string) {
  revalidatePath("/expenses")
  revalidatePath(`/expenses/${period}`)
}

export type SetEntryInput = {
  periodId: string
  period: string
  itemId: string
  supplierId: string | null
  amount: number
  note: string | null
}

export async function setExpenseEntry(input: SetEntryInput): Promise<ActionResult> {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: "An amount of zero or more is required." }
  }
  if (!input.itemId) {
    return { ok: false, error: "Pick the expense." }
  }

  const { error } = await supabase.rpc("set_expense_entry", {
    p_period_id: input.periodId,
    p_item_id: input.itemId,
    p_supplier_id: input.supplierId,
    p_amount: input.amount,
    p_note: input.note?.trim() || null,
    p_by: await actor(),
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate(input.period)
  return { ok: true }
}

export async function voidExpenseEntry(
  id: string,
  period: string,
  reason: string
): Promise<ActionResult> {
  if (reason.trim().length < 4) {
    return { ok: false, error: "A reason of at least 4 characters is required." }
  }

  const { error } = await supabase.rpc("void_expense_entry", {
    p_id: id,
    p_by: await actor(),
    p_reason: reason,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate(period)
  return { ok: true }
}

export async function closeExpenseMonth(id: string, period: string): Promise<ActionResult> {
  const { error } = await supabase.rpc("close_expense_period", { p_id: id, p_by: await actor() })
  if (error) return { ok: false, error: readable(error.message) }

  revalidate(period)
  return { ok: true }
}

export async function reopenExpenseMonth(
  id: string,
  period: string,
  reason: string
): Promise<ActionResult> {
  if (reason.trim().length < 4) {
    return { ok: false, error: "A reason of at least 4 characters is required." }
  }

  const { error } = await supabase.rpc("reopen_expense_period", {
    p_id: id,
    p_by: await actor(),
    p_reason: reason,
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidate(period)
  return { ok: true }
}

export async function startExpenseMonth(period: string): Promise<ActionResult> {
  const { error } = await supabase.rpc("start_expense_month", {
    p_period: period,
    p_by: await actor(),
  })

  if (error) return { ok: false, error: readable(error.message) }

  revalidatePath("/expenses")
  return { ok: true }
}

export type CreateItemResult =
  | { ok: true; item: { id: string; name: string; categoryLabel: string } }
  | { ok: false; error: string }

export async function createExpenseItem(input: {
  name: string
  categoryId: string
  categoryLabel: string
  period: string
}): Promise<CreateItemResult> {
  const name = input.name.trim()
  if (name.length < 2) {
    return { ok: false, error: "A name of at least 2 characters is required." }
  }
  if (!input.categoryId) {
    return { ok: false, error: "Pick a category." }
  }

  const { data, error } = await supabase
    .from("expense_items")
    .insert({ name, category_id: input.categoryId })
    .select("id, name")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `"${name}" is already an expense.` }
    }
    return { ok: false, error: error.message }
  }

  revalidate(input.period)
  return {
    ok: true,
    item: {
      id: data.id as string,
      name: data.name as string,
      categoryLabel: input.categoryLabel,
    },
  }
}
