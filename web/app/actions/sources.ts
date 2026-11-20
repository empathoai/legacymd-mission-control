"use server"

import { revalidatePath } from "next/cache"

import { supabase } from "@/lib/supabase/server"

export type SourceOption = { id: string; label: string }
export type CreateSourceResult =
  | { ok: true; source: SourceOption }
  | { ok: false; error: string }

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Channels are an open catalog: a new one appears while the desk is typing it.
 * The slug is derived, never typed, and an existing slug returns its row so a
 * double submit does not create "TikTok" twice.
 */
export async function createSource(label: string): Promise<CreateSourceResult> {
  const clean = label.trim().replace(/\s+/g, " ")
  if (clean.length < 2) {
    return { ok: false, error: "A channel needs at least 2 characters." }
  }

  const slug = slugify(clean)
  if (!slug) {
    return { ok: false, error: "That name has no letters or numbers." }
  }

  const { data: existing } = await supabase
    .from("sources")
    .select("id, label")
    .eq("slug", slug)
    .maybeSingle()

  if (existing) {
    return { ok: true, source: { id: existing.id as string, label: existing.label as string } }
  }

  const { data: last } = await supabase
    .from("sources")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from("sources")
    .insert({
      slug,
      label: clean,
      sort_order: ((last?.sort_order as number | null) ?? 0) + 10,
    })
    .select("id, label")
    .single()

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("sources")
        .select("id, label")
        .eq("slug", slug)
        .maybeSingle()
      if (raced) {
        return { ok: true, source: { id: raced.id as string, label: raced.label as string } }
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/sales/new")
  revalidatePath("/appointments")

  return { ok: true, source: { id: data.id as string, label: data.label as string } }
}
