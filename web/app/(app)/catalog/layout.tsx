import { CatalogNav } from "@/components/catalog-nav"

export const dynamic = "force-dynamic"

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Five catalogs, each with its own code, price and history.
        </p>
      </div>
      <CatalogNav />
      {children}
    </div>
  )
}
