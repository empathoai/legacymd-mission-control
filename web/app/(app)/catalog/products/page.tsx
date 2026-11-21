import { FlaskConical } from "lucide-react"

import { CatalogScreen } from "@/components/catalog-screen"
import { listCatalog } from "@/lib/catalog"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : undefined
  const rows = await listCatalog("products", q)

  return (
    <CatalogScreen
      kind="product"
      icon={FlaskConical}
      title="Products"
      description="Retail skincare and injectables with active pricing and cost history."
      rows={rows}
      query={q}
    />
  )
}
