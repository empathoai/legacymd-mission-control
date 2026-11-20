import Link from "next/link"
import { Wallet } from "lucide-react"

import { startExpenseMonth } from "@/app/(app)/expenses/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { clinicToday } from "@/lib/dates"
import { listExpenseMonths } from "@/lib/expenses"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function monthLabel(period: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${period}T12:00:00`))
}

export default async function Page() {
  const months = await listExpenseMonths()
  const currentPeriod = `${clinicToday().slice(0, 7)}-01`
  const current = months.find((month) => month.period === currentPeriod)
  const hasCurrent = Boolean(current)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Expenses</h2>
        <p className="text-sm text-muted-foreground">
          What the clinic spent each month, and what the month left after it.
        </p>
      </div>

      {current ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Sold in {monthLabel(current.period)}</CardDescription>
              <CardTitle className="text-2xl">{money.format(current.sold)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Net of returns</CardDescription>
              <CardTitle className="text-2xl">{money.format(current.netRevenue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {current.returned > 0
                  ? `${money.format(current.returned)} returned`
                  : "No returns this month"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Expenses</CardDescription>
              <CardTitle className="text-2xl">{money.format(current.expenses)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {current.entries} line{current.entries === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Left after expenses</CardDescription>
              <CardTitle
                className={`text-2xl ${current.result < 0 ? "text-destructive" : ""}`}
              >
                {money.format(current.result)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {months.length} month{months.length === 1 ? "" : "s"}
        </span>
        {hasCurrent ? null : (
          <form
            action={async () => {
              "use server"
              await startExpenseMonth(currentPeriod)
            }}
          >
            <Button type="submit" variant="outline">
              Start {monthLabel(currentPeriod)}
            </Button>
          </form>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Month</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24 text-right">Lines</TableHead>
              <TableHead className="w-40 text-right">Total</TableHead>
              <TableHead className="w-40 text-right">Sold</TableHead>
              <TableHead className="text-right">Left</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Wallet />
                      </EmptyMedia>
                      <EmptyTitle>No months yet</EmptyTitle>
                      <EmptyDescription>
                        Start the current month to begin recording expenses.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              months.map((month) => (
                <TableRow key={month.id}>
                  <TableCell>
                    <Link
                      href={`/expenses/${month.period}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {monthLabel(month.period)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {month.status === "closed" ? (
                      <Badge variant="secondary">Closed</Badge>
                    ) : (
                      <Badge>Open</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{month.entries}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(month.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(month.sold)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${month.result < 0 ? "text-destructive" : ""}`}
                  >
                    {money.format(month.result)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        A closed month keeps the total it had when it was closed; reopening it with a reason
        unlocks the edits.
      </p>
    </div>
  )
}
