import Link from "next/link"
import { Wallet } from "lucide-react"

import { OpenItemActions } from "@/components/open-item-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatClinicDay } from "@/lib/dates"
import { listForecast, listOpenItems, type OpenItem } from "@/lib/open-items"
import { listPaymentMethods } from "@/lib/sale-entry"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function groupByMonth(rows: OpenItem[]) {
  const groups: { label: string; rows: OpenItem[] }[] = []
  for (const row of rows) {
    const label = monthLabel(row.dueOn.slice(0, 7) + "-01")
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(row)
    else groups.push({ label, rows: [row] })
  }
  return groups
}

export default async function Page() {
  const [installments, methods, forecast] = await Promise.all([
    listOpenItems(),
    listPaymentMethods(),
    listForecast(),
  ])

  const thisMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())

  const expectedThisMonth = installments
    .filter((row) => row.dueOn.slice(0, 7) === thisMonth)
    .reduce((sum, row) => sum + row.remaining, 0)

  const overdue = installments.filter((row) => row.overdue)
  const overdueTotal = overdue.reduce((sum, row) => sum + row.remaining, 0)
  const receivedThisMonth =
    forecast.find((row) => row.month.slice(0, 7) === thisMonth)?.received ?? 0

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Open Items</h2>
        <p className="text-sm text-muted-foreground">
          What is still expected, what is late, and what already came in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Expected this month</CardDescription>
            <CardTitle className="text-2xl">{money.format(expectedThisMonth)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {installments.filter((row) => row.dueOn.slice(0, 7) === thisMonth).length} installment
              {installments.filter((row) => row.dueOn.slice(0, 7) === thisMonth).length === 1
                ? ""
                : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Overdue</CardDescription>
            <CardTitle className={`text-2xl ${overdueTotal > 0 ? "text-destructive" : ""}`}>
              {money.format(overdueTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {overdue.length} past due{overdue.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Received this month</CardDescription>
            <CardTitle className="text-2xl">{money.format(receivedThisMonth)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From receipts, not from the plan</p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Due</TableHead>
              <TableHead className="w-48">Patient</TableHead>
              <TableHead className="w-28">Sale</TableHead>
              <TableHead className="w-24 text-right">Amount</TableHead>
              <TableHead className="w-24 text-right">Paid</TableHead>
              <TableHead className="w-28 text-right">Remaining</TableHead>
              <TableHead className="text-right">·</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Wallet />
                      </EmptyMedia>
                      <EmptyTitle>Nothing is expected</EmptyTitle>
                      <EmptyDescription>
                        Every sale is collected. When one is sold on a plan, its installments land
                        here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              groupByMonth(installments).map((group, index) => (
                <TableRows key={`${group.label}-${index}`} group={group} methods={methods} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Recording a payment appends a receipt; cancelling an installment stops expecting it, with a
        reason. Neither one edits the sale.
      </p>
    </div>
  )
}

function TableRows({
  group,
  methods,
}: {
  group: { label: string; rows: OpenItem[] }
  methods: Awaited<ReturnType<typeof listPaymentMethods>>
}) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={7} className="bg-muted/40 py-1.5 text-xs font-medium">
          {group.label}
        </TableCell>
      </TableRow>
      {group.rows.map((row) => (
        <TableRow key={row.id}>
          <TableCell className="whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums">{formatClinicDay(row.dueOn)}</span>
              {row.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
              {row.dueToday ? <Badge>Today</Badge> : null}
            </div>
          </TableCell>
          <TableCell className="truncate">
            <Link
              href={`/patients/${row.customerId}`}
              className="underline-offset-4 hover:underline"
              title={row.customerName}
            >
              {row.customerName}
            </Link>
          </TableCell>
          <TableCell className="text-muted-foreground">
            {formatClinicDay(row.saleOccurredOn)}
          </TableCell>
          <TableCell className="text-right tabular-nums">{money.format(row.amount)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">
            {money.format(row.paid)}
          </TableCell>
          <TableCell className="text-right font-medium tabular-nums">
            {money.format(row.remaining)}
          </TableCell>
          <TableCell>
            <OpenItemActions installment={row} methods={methods} />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
