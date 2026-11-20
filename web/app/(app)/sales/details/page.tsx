import Link from "next/link"
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react"

import { DateFilter } from "@/components/date-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { clinicToday, formatClinicDay } from "@/lib/dates"
import { listSaleLines, SALE_LINES_PER_PAGE } from "@/lib/sales"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function label(row: { kind: string; unitType: string | null }) {
  if (row.kind === "treatment") {
    if (row.unitType === "package") return "Package"
    if (row.unitType === "membership") return "Membership"
    return "Treatment"
  }
  if (row.kind === "product") return "Product"
  if (row.kind === "service") return "Service"
  return "Other"
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[]
    date?: string | string[]
    from?: string | string[]
    to?: string | string[]
  }>
}) {
  const params = await searchParams
  const rawPage = typeof params.page === "string" ? Number(params.page) : 1
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1

  const today = clinicToday()
  const rangeMode =
    typeof params.from === "string" || typeof params.to === "string"
  const date = validDay(params.date) ? params.date : today
  const from = validDay(params.from) ? params.from : date
  const to = validDay(params.to) ? params.to : from

  const data = await listSaleLines(page, rangeMode ? { from, to } : { date })

  const first =
    data.total === 0 ? 0 : (data.page - 1) * SALE_LINES_PER_PAGE + 1
  const last = Math.min(data.page * SALE_LINES_PER_PAGE, data.total)
  const periodLabel =
    rangeMode && from !== to
      ? `${formatClinicDay(from)} – ${formatClinicDay(to)}`
      : formatClinicDay(rangeMode ? from : date)
  const isToday = rangeMode ? from === today && to === today : date === today
  const columns = rangeMode ? 8 : 7

  const pageHref = (target: number) =>
    rangeMode
      ? `/sales/details?from=${from}&to=${to}&page=${target}`
      : `/sales/details?date=${date}&page=${target}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Sales details</h2>
        <p className="text-sm text-muted-foreground">
          Every sold line: the patient, the item and what was charged.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <DateFilter
            mode={rangeMode ? "range" : "day"}
            date={date}
            from={from}
            to={to}
          />
          {!isToday ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={
                    rangeMode
                      ? `/sales/details?from=${today}&to=${today}`
                      : `/sales/details?date=${today}`
                  }
                />
              }
            >
              Today
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {data.total === 0
              ? "No lines"
              : `${first}–${last} of ${data.total} lines`}
          </span>
          <Badge variant="secondary">{periodLabel}</Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {rangeMode ? <TableHead>Date</TableHead> : null}
              <TableHead>Patient</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns} className="p-0">
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Receipt />
                      </EmptyMedia>
                      <EmptyTitle>No lines in {periodLabel}</EmptyTitle>
                      <EmptyDescription>
                        Pick another period, or record a sale.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow key={row.saleItemId}>
                  {rangeMode ? (
                    <TableCell className="whitespace-nowrap">
                      {formatClinicDay(row.occurredOn)}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Link
                      href={`/patients/${row.customerId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{row.itemName}</TableCell>
                  <TableCell className="text-muted-foreground">{label(row)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(row.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money.format(row.lineTotal)}
                  </TableCell>
                  <TableCell>
                    {row.voided ? (
                      <Badge variant="destructive">Voided</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            nativeButton={false}
            render={<Link href={pageHref(data.page - 1)} />}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.pageCount}
          </span>
          <Button
            variant="outline"
            disabled={data.page >= data.pageCount}
            nativeButton={false}
            render={<Link href={pageHref(data.page + 1)} />}
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
