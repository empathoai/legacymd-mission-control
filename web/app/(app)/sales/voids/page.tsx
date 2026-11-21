import Link from "next/link"
import { Ban } from "lucide-react"

import { PatientSearch } from "@/components/patient-search"
import { TableScrollHint } from "@/components/table-scroll-hint"
import { VoidSaleDialog } from "@/components/void-sale-dialog"
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
import { listVoidableSales, listVoidedSales } from "@/lib/returns"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim() : ""

  const [sales, history] = await Promise.all([listVoidableSales(q), listVoidedSales(10)])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Voids</h1>
        <p className="text-sm text-muted-foreground">
          Sales entered by mistake, with no money collected. They never happened.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PatientSearch defaultValue={q} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {sales.length} sale{sales.length === 1 ? "" : "s"}
          </span>
          <Badge variant="secondary">{q ? "Search" : formatClinicDay(clinicToday())}</Badge>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-lg border">
          <Empty className="rounded-none border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Ban />
              </EmptyMedia>
              <EmptyTitle>
                {q ? "That patient has nothing to void" : "Nothing to void today"}
              </EmptyTitle>
              <EmptyDescription>
                A sale appears here only when nothing was collected. Money collected is
                corrected with a return, not a void.
              </EmptyDescription>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={q ? "/sales/voids" : "/sales/new"} />}
              >
                {q ? "Clear the search" : "Record a sale"}
              </Button>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          <TableScrollHint />

          <div className="overflow-hidden rounded-lg border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-56">Patient</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-32 text-right">Collected</TableHead>
                  <TableHead className="w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                <TableRow key={sale.saleId}>
                  <TableCell className="whitespace-nowrap">
                    {formatClinicDay(sale.occurredOn)}
                  </TableCell>
                  <TableCell className="truncate">
                    <Link
                      href={`/patients/${sale.customerId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {sale.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(sale.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money.format(sale.collected)}
                  </TableCell>
                  <TableCell className="text-right">
                    <VoidSaleDialog sale={sale} />
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Voided sales</span>
          <span className="text-xs text-muted-foreground">The last ten, with their reason.</span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-44">Patient</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-28">Voided by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No sale has been voided.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.saleId}>
                    <TableCell className="whitespace-nowrap">
                      {formatClinicDay(row.occurredOn)}
                    </TableCell>
                    <TableCell className="truncate">
                      {row.customerId ? (
                        <Link
                          href={`/patients/${row.customerId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {row.customerName}
                        </Link>
                      ) : (
                        row.customerName
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(row.total)}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" title={row.reason ?? undefined}>
                      {row.reason ?? "—"}
                    </TableCell>
                    <TableCell
                      className="truncate text-muted-foreground"
                      title={row.voidedBy ?? undefined}
                    >
                      {row.voidedBy ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
