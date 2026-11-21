import type { LucideIcon } from "lucide-react"

import type { CatalogKind } from "@/app/(app)/catalog/actions"
import { CatalogCreateDialog } from "@/components/catalog-create-dialog"
import { CatalogEditDialog } from "@/components/catalog-edit-dialog"
import { CatalogSearch } from "@/components/catalog-search"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CatalogRow } from "@/lib/catalog"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function amount(value: number | null) {
  return value === null ? "—" : money.format(value)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function marginOf(row: CatalogRow): number | null {
  if (row.price === null || row.cost === null) return null
  return row.price - row.cost
}

function marginPercent(row: CatalogRow): number | null {
  if (row.price === null || row.cost === null || row.price === 0) return null
  return Math.round(((row.price - row.cost) / row.price) * 1000) / 10
}

export function CatalogScreen({
  title,
  description,
  icon: Icon,
  rows,
  kind,
  unitType,
  query,
}: {
  title: string
  description: string
  icon: LucideIcon
  rows: CatalogRow[]
  kind: CatalogKind
  unitType?: "unit" | "package" | "membership"
  query?: string
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">{title}</h2>
            <Badge variant="secondary">{rows.length}</Badge>
          </div>
          <CatalogCreateDialog kind={kind} unitType={unitType} />
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <CatalogSearch defaultValue={query} />

      {rows.length === 0 ? (
        <div className="rounded-lg border">
          <Empty className="rounded-none border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon />
              </EmptyMedia>
              <EmptyTitle>Nothing here yet</EmptyTitle>
              <EmptyDescription>
                Use the New button to add the first one.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
      <div className="rounded-lg border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-24 sm:table-cell">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden w-28 text-right sm:table-cell">
                Cost today
              </TableHead>
              <TableHead className="w-28 text-right">Price</TableHead>
              <TableHead
                className="hidden w-28 text-right lg:table-cell"
                title="At list price and today's cost"
              >
                Margin
              </TableHead>
              <TableHead className="w-36 pl-4 sm:w-44 sm:pl-8">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const margin = marginOf(row)
              const percent = marginPercent(row)
              return (
                <TableRow key={row.itemId}>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {row.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="block truncate" title={row.name}>
                      {row.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                      {amount(row.cost)} cost
                      {margin === null
                        ? ""
                        : ` · ${money.format(margin)} margin (${percent}%)`}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {amount(row.cost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{amount(row.price)}</span>
                      {row.nextPrice !== null && row.nextPriceFrom ? (
                        <span className="text-xs text-muted-foreground">
                          {amount(row.nextPrice)} from {shortDate(row.nextPriceFrom)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {margin === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{money.format(margin)}</span>
                        {percent !== null ? (
                          <span className="text-xs text-muted-foreground">
                            {percent}%
                          </span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="pl-4 sm:pl-8">
                    <div className="flex w-full items-center justify-between gap-2">
                      {row.active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      <CatalogEditDialog
                        kind={kind}
                        itemId={row.itemId}
                        code={row.code}
                        name={row.name}
                        price={row.price}
                        cost={row.cost}
                        nextPrice={row.nextPrice}
                        nextPriceFrom={row.nextPriceFrom}
                        active={row.active}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      )}

      {rows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Margin is a reference: list price − today&apos;s cost. The monthly report is
          the authority for realized margin.
        </p>
      ) : null}
    </div>
  )
}
