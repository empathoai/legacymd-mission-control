"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"

export type CatalogKind = "treatment" | "product" | "service"

export type SaveCatalogInput = {
  kind: CatalogKind
  itemId: string
  price: number
  priceDirty?: boolean
  appliesFrom: "today" | "tomorrow"
  active: boolean
  cost?: number | null
  costDirty?: boolean
}

export type SaveCatalogResult = { ok: true } | { ok: false; error: string }

const tableByKind: Record<CatalogKind, string> = {
  treatment: "treatments",
  product: "products",
  service: "services",
}

function clinicDay(offsetDays: number) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  const [year, month, day] = today.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays))
  return shifted.toISOString().slice(0, 10)
}

function clinicOffset(date: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${date}T12:00:00Z`))

  const name = parts.find((part) => part.type === "timeZoneName")?.value
  return (name ?? "GMT-05:00").replace("GMT", "") || "+00:00"
}

function clinicInstant(offsetDays: number) {
  if (offsetDays <= 0) {
    return new Date().toISOString()
  }
  const date = clinicDay(offsetDays)
  return new Date(`${date}T00:00:00${clinicOffset(date)}`).toISOString()
}

export type CreateCatalogInput = {
  kind: CatalogKind
  unitType?: "unit" | "package" | "membership"
  name: string
  price: number
  cost?: number | null
  description?: string | null
}

async function describeExistingName(
  kind: CatalogKind,
  name: string,
  unitType?: "unit" | "package" | "membership"
): Promise<string | null> {
  const { data: normalized } = await supabase.rpc("normalize_item_name", {
    p_name: name,
  })

  if (!normalized) return null

  let query = supabase
    .from(tableByKind[kind])
    .select("code, unit_type")
    .eq("normalized_name", normalized as string)

  if (kind === "treatment" && unitType) {
    query = query.eq("unit_type", unitType)
  }

  const { data } = await query.maybeSingle()

  if (!data) return null

  if (kind === "treatment") {
    if (data.unit_type === "package") {
      return `It already exists as package ${data.code} in Packages.`
    }
    if (data.unit_type === "membership") {
      return `It already exists as membership ${data.code} in Memberships.`
    }
    return `It already exists as treatment ${data.code} in Treatments.`
  }

  return `It already exists as ${data.code} in ${
    kind === "product" ? "Products" : "Services"
  }.`
}

export async function createCatalogItem(
  input: CreateCatalogInput
): Promise<SaveCatalogResult> {
  const name = input.name.trim()

  if (name.length < 2) {
    return { ok: false, error: "A name of at least 2 characters is required." }
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, error: "Price must be zero or more." }
  }
  if (input.cost != null && (!Number.isFinite(input.cost) || input.cost < 0)) {
    return { ok: false, error: "Cost must be zero or more." }
  }

  const payload: Record<string, unknown> = { name, price: input.price }

  if (input.kind === "treatment") {
    payload.unit_type = input.unitType ?? "unit"
    const description = input.description?.trim()
    if (description) payload.description = description
  }

  const { data, error } = await supabase
    .from(tableByKind[input.kind])
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      const existing = await describeExistingName(input.kind, name, input.unitType)
      return {
        ok: false,
        error: existing
          ? `That name is taken. ${existing}`
          : "An item with that name already exists in this catalog.",
      }
    }
    return { ok: false, error: error.message }
  }

  const { error: priceError } = await supabase.rpc("set_item_price", {
    p_kind: input.kind,
    p_item_id: data.id,
    p_price: input.price,
    p_from: clinicDay(0),
    p_note: "created from the catalog screen",
  })

  if (priceError) {
    return { ok: false, error: priceError.message }
  }

  if (input.cost != null) {
    const { error: costError } = await supabase.rpc("set_item_cost", {
      p_kind: input.kind,
      p_item_id: data.id,
      p_cost: input.cost,
      p_from: new Date().toISOString(),
    })

    if (costError) {
      return { ok: false, error: costError.message }
    }
  }

  revalidatePath("/catalog", "layout")
  return { ok: true }
}

export async function saveCatalogItem(
  input: SaveCatalogInput
): Promise<SaveCatalogResult> {
  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, error: "Price must be zero or more." }
  }

  const from = clinicDay(input.appliesFrom === "tomorrow" ? 1 : 0)

  if (input.priceDirty !== false) {
    const { error: priceError } = await supabase.rpc("set_item_price", {
      p_kind: input.kind,
      p_item_id: input.itemId,
      p_price: input.price,
      p_from: from,
      p_note: "edited from the catalog screen",
    })

    if (priceError) {
      return { ok: false, error: priceError.message }
    }
  }

  const { error: activeError } = await supabase
    .from(tableByKind[input.kind])
    .update({ active: input.active })
    .eq("id", input.itemId)

  if (activeError) {
    return { ok: false, error: activeError.message }
  }

  if (input.costDirty) {
    if (input.cost == null || !Number.isFinite(input.cost) || input.cost < 0) {
      return { ok: false, error: "Cost must be zero or more." }
    }

    const { error: costError } = await supabase.rpc("set_item_cost", {
      p_kind: input.kind,
      p_item_id: input.itemId,
      p_cost: input.cost,
      p_from: clinicInstant(input.appliesFrom === "tomorrow" ? 1 : 0),
    })

    if (costError) {
      return { ok: false, error: costError.message }
    }
  }

  revalidatePath("/catalog", "layout")
  return { ok: true }
}
