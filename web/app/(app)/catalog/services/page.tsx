import { Stethoscope } from "lucide-react"

import { CatalogScreen } from "@/components/catalog-screen"
import { listCatalog } from "@/lib/catalog"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : undefined
  const rows = await listCatalog("services", q)

  return (
    <CatalogScreen
      kind="service"
      icon={Stethoscope}
      title="Services"
      description="Everything the clinic sells that is neither a treatment nor a product, such as consultations."
      rows={rows}
      query={q}
    />
  )
}
