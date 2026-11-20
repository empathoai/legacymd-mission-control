"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"

export type CreateCustomerInput = {
  name: string
  phone?: string | null
  birthDate?: string | null
}

export type CreateCustomerResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; existing?: { id: string; name: string; phone: string | null } }

export async function createCustomer(
  input: CreateCustomerInput
): Promise<CreateCustomerResult> {
  const name = input.name.trim()
  const phoneRaw = input.phone?.trim() ?? ""
  const birthDate = input.birthDate?.trim() || null

  if (name.length < 2) {
    return { ok: false, error: "A name of at least 2 characters is required." }
  }

  let phone: string | null = null
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, "")
    if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
      return {
        ok: false,
        error: "Enter a 10-digit phone number, for example 3055551234.",
      }
    }
    phone = digits.length === 11 ? digits.slice(1) : digits
  }

  const { data: normalized } = await supabase.rpc("normalize_person_name", {
    p_name: name,
  })

  const { data: existing } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .eq("normalized_name", normalized as string)
    .maybeSingle()

  if (existing) {
    return {
      ok: false,
      error: "That patient is already in the master.",
      existing: {
        id: existing.id as string,
        name: existing.full_name as string,
        phone: existing.phone as string | null,
      },
    }
  }

  const { data: id, error } = await supabase.rpc("resolve_customer", {
    p_name: name,
    p_phone: phone,
    p_birth: birthDate,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/patients/report")

  return { ok: true, id: id as string, name }
}
