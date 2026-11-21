import Link from "next/link"
import { RotateCcw } from "lucide-react"

import { PatientSearch } from "@/components/patient-search"
import { ReturnSaleDialog } from "@/components/return-sale-dialog"
import { SettleReturnDialog } from "@/components/settle-return-dialog"
import { TableScrollHint } from "@/components/table-scroll-hint"
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
import { listRecordedReturns, listReturnableSales } from "@/lib/returns"
import { listPaymentMethods } from "@/lib/sale-entry"

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

  const [sales, methods, history] = await Promise.all([
    listReturnableSales(q),
    listPaymentMethods(),
    listRecordedReturns(10),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Returns</h1>
        <p className="text-sm text-muted-foreground">
          Sales that can still give money back. The sale stays; the money returns.
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
                <RotateCcw />
              </EmptyMedia>
              <EmptyTitle>
                {q ? "That patient has nothing to return" : "Nothing to return today"}
              </EmptyTitle>
              <EmptyDescription>
                A sale with money collected appears here until it is returned in full.
              </EmptyDescription>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link href={q ? "/sales/returns" : "/patients/report"} />
                }
              >
                {q ? "Clear the search" : "Find a patient's sales"}
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
                  <TableHead className="w-48">Patient</TableHead>
                  <TableHead className="w-24 text-right">Sold</TableHead>
                  <TableHead className="w-24 text-right">Collected</TableHead>
                  <TableHead className="w-24 text-right">Returned</TableHead>
                  <TableHead className="w-28 text-right">Can return</TableHead>
                  <TableHead className="w-24 text-right">
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
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money.format(sale.returned)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money.format(sale.remaining)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ReturnSaleDialog sale={sale} methods={methods} />
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
          <span className="text-sm font-medium">Recorded returns</span>
          <span className="text-xs text-muted-foreground">
            The last ten. A pending one still owes the money.
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-44">Patient</TableHead>
                <TableHead className="w-24 text-right">Amount</TableHead>
                <TableHead className="w-24">Method</TableHead>
                <TableHead className="w-24">State</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No returns recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatClinicDay(row.refundedOn)}
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
                      {money.format(row.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.methodLabel}</TableCell>
                    <TableCell>
                      {row.state === "pending" ? (
                        <Badge variant="destructive">Pending</Badge>
                      ) : (
                        <Badge variant="secondary">Refunded</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.state === "pending" ? (
                        <SettleReturnDialog
                          id={row.id}
                          amount={row.amount}
                          customerName={row.customerName}
                        />
                      ) : null}
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
