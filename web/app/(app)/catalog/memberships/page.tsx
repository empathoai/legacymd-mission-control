import { Crown } from "lucide-react"

import { CatalogScreen } from "@/components/catalog-screen"
import { listCatalog } from "@/lib/catalog"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : undefined
  const rows = await listCatalog("memberships", q)

  return (
    <CatalogScreen
      kind="treatment"
      unitType="membership"
      icon={Crown}
      title="Memberships"
      description="Recurring plans sold once (for example a Botox membership). The price is the plan's price and its terms live in the description."
      rows={rows}
      query={q}
    />
  )
}
