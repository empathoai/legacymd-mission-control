import { Sparkles } from "lucide-react"

import { CatalogScreen } from "@/components/catalog-screen"
import { listCatalog } from "@/lib/catalog"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : undefined
  const rows = await listCatalog("treatments", q)

  return (
    <CatalogScreen
      kind="treatment"
      unitType="unit"
      icon={Sparkles}
      title="Treatments"
      description="Single-session treatments. The category here is a suggestion; the sale line records the real one."
      rows={rows}
      query={q}
    />
  )
}
