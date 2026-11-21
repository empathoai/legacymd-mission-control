import "server-only"

import { supabase } from "@/lib/supabase/server"

export type CatalogKind =
  | "treatments"
  | "packages"
  | "memberships"
  | "products"
  | "services"

export type CatalogRow = {
  itemId: string
  code: string
  name: string
  price: number | null
  cost: number | null
  active: boolean
  nextPrice: number | null
  nextPriceFrom: string | null
  sessionsMinimum: number | null
}

export async function listCatalog(
  kind: CatalogKind,
  query?: string
): Promise<CatalogRow[]> {
  let request = supabase
    .from("catalog_items")
    .select(
      "item_id, code, name, price, current_cost, active, item_kind, unit_type, next_price, next_price_from"
    )

  if (kind === "treatments") {
    request = request.eq("item_kind", "treatment").eq("unit_type", "unit")
  } else if (kind === "packages") {
    request = request.eq("item_kind", "treatment").eq("unit_type", "package")
  } else if (kind === "memberships") {
    request = request.eq("item_kind", "treatment").eq("unit_type", "membership")
  } else if (kind === "products") {
    request = request.eq("item_kind", "product")
  } else {
    request = request.eq("item_kind", "service")
  }

  const isTreatmentKind =
    kind === "treatments" || kind === "packages" || kind === "memberships"

  const [{ data, error }, minsRes] = await Promise.all([
    request.order("code"),
    isTreatmentKind
      ? supabase
          .from("treatments")
          .select("id, sessions_minimum")
          .not("sessions_minimum", "is", null)
      : Promise.resolve({ data: [] as { id: string; sessions_minimum: number | null }[], error: null }),
  ])

  if (error) {
    throw new Error(`catalog query failed: ${error.message}`)
  }

  const minsById = new Map<string, number>()
  for (const m of minsRes.data ?? []) {
    if (m.sessions_minimum != null) {
      minsById.set(m.id as string, Number(m.sessions_minimum))
    }
  }

  const rows = (data ?? []).map((row) => ({
    itemId: row.item_id as string,
    code: row.code as string,
    name: row.name as string,
    price: row.price as number | null,
    cost: row.current_cost as number | null,
    active: row.active as boolean,
    nextPrice: row.next_price as number | null,
    nextPriceFrom: row.next_price_from as string | null,
    sessionsMinimum: minsById.get(row.item_id as string) ?? null,
  }))

  const term = query?.trim().toLowerCase()
  if (!term) return rows

  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(term) ||
      row.code.toLowerCase().includes(term)
  )
}
