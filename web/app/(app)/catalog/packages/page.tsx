import { Package } from "lucide-react"

import { CatalogScreen } from "@/components/catalog-screen"
import { listCatalog } from "@/lib/catalog"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : undefined
  const rows = await listCatalog("packages", q)

  return (
    <CatalogScreen
      kind="treatment"
      unitType="package"
      icon={Package}
      title="Packages"
      description="Bundled treatment packages priced as a single item, with included sessions listed in the description."
      rows={rows}
      query={q}
    />
  )
}
