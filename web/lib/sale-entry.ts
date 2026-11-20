import "server-only"

import { supabase } from "@/lib/supabase/server"

export type SellableItem = {
  itemId: string
  kind: "treatment" | "product" | "service"
  code: string
  name: string
  price: number
  unitType: "unit" | "package" | "membership" | null
}

export async function listSellableItems(): Promise<SellableItem[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("item_id, item_kind, code, name, price, unit_type")
    .eq("active", true)
    .not("price", "is", null)
    .order("name")

  if (error) {
    throw new Error(`catalog query failed: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    itemId: row.item_id as string,
    kind: row.item_kind as SellableItem["kind"],
    code: row.code as string,
    name: row.name as string,
    price: Number(row.price),
    unitType: (row.unit_type as SellableItem["unitType"]) ?? null,
  }))
}

export type SourceOption = { id: string; label: string }

export async function listSources(): Promise<SourceOption[]> {
  const { data, error } = await supabase
    .from("sources")
    .select("id, label")
    .order("sort_order")

  if (error) {
    throw new Error(`sources query failed: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
  }))
}

export type MethodOption = {
  id: string
  label: string
  slug: string
  settlesImmediately: boolean
}

export async function listPaymentMethods(): Promise<MethodOption[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, label, slug, settles_immediately")
    .order("sort_order")

  if (error) {
    throw new Error(`payment methods query failed: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    slug: row.slug as string,
    settlesImmediately: row.settles_immediately as boolean,
  }))
}
