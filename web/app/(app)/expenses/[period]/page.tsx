import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Wallet } from "lucide-react"

import { ExpenseEntryDialog } from "@/components/expense-entry-dialog"
import { ExpenseVoidDialog } from "@/components/expense-void-dialog"
import { MonthStatusActions } from "@/components/month-status-actions"
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
import { formatClinicDay } from "@/lib/dates"
import {
  getExpenseMonth,
  listExpenseCategories,
  listExpenseItems,
  listSuppliers,
} from "@/lib/expenses"

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

export default async function Page({
  params,
}: {
  params: Promise<{ period: string }>
}) {
  const { period } = await params
  if (!/^\d{4}-\d{2}-01$/.test(period)) notFound()

  const month = await getExpenseMonth(period)
  if (!month) notFound()

  const [items, suppliers, categories] = await Promise.all([
    listExpenseItems(),
    listSuppliers(),
    listExpenseCategories(),
  ])

  const open = month.status === "open"

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          nativeButton={false}
          render={<Link href="/expenses" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Expenses
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{monthLabel(month.period)}</h2>
            {open ? <Badge>Open</Badge> : <Badge variant="secondary">Closed</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {open ? (
              <ExpenseEntryDialog
                periodId={month.id}
                period={month.period}
                items={items}
                suppliers={suppliers}
                categories={categories}
                lines={month.lines}
              />
            ) : null}
            <MonthStatusActions
              id={month.id}
              period={month.period}
              status={month.status}
              total={month.total}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Sold</CardDescription>
            <CardTitle className="text-2xl">{money.format(month.sold)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {month.returned > 0
                ? `${money.format(month.returned)} returned · ${money.format(month.netRevenue)} net`
                : "No returns this month"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Expenses</CardDescription>
            <CardTitle className="text-2xl">{money.format(month.total)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {month.entries} live line{month.entries === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Left after expenses</CardDescription>
            <CardTitle className={`text-2xl ${month.result < 0 ? "text-destructive" : ""}`}>
              {money.format(month.result)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Closed</CardDescription>
            <CardTitle className="text-base font-medium">
              {month.closedAt ? formatClinicDay(month.closedAt.slice(0, 10)) : "Still open"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {month.categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {month.categories.map((category) => (
            <div
              key={category.label}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
            >
              <span className="text-muted-foreground">{category.label}</span>
              <span className="font-medium tabular-nums">{money.format(category.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">Expense</TableHead>
              <TableHead className="w-44">Category</TableHead>
              <TableHead className="w-40">Supplier</TableHead>
              <TableHead className="w-28 text-right">Amount</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-24 text-right">·</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {month.lines.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Wallet />
                      </EmptyMedia>
                      <EmptyTitle>No expenses in this month</EmptyTitle>
                      <EmptyDescription>
                        {open
                          ? "Add the rent, the payroll, the labs."
                          : "The month closed with no lines."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              month.lines.map((line) => (
                <TableRow key={line.id} className={line.voided ? "opacity-60" : undefined}>
                  <TableCell className="truncate" title={line.itemName}>
                    {line.voided ? (
                      <span className="line-through">{line.itemName}</span>
                    ) : (
                      line.itemName
                    )}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {line.categoryLabel}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {line.supplierName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(line.amount)}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground" title={line.voidReason ?? line.note ?? undefined}>
                    {line.voided ? (
                      <Badge variant="destructive">Voided · {line.voidReason}</Badge>
                    ) : (
                      (line.note ?? "—")
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {open && !line.voided ? (
                        <>
                          <ExpenseEntryDialog
                            periodId={month.id}
                            period={month.period}
                            items={items}
                            suppliers={suppliers}
                            categories={categories}
                            lines={month.lines}
                            entry={line}
                          />
                          <ExpenseVoidDialog
                            id={line.id}
                            period={month.period}
                            itemName={line.itemName}
                          />
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {month.audit.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Record</span>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {month.audit.map((row, index) => (
              <li key={`${row.changedAt}-${index}`}>
                {formatClinicDay(row.changedAt.slice(0, 10))} · {row.oldStatus} → {row.newStatus} ·{" "}
                {row.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        A closed month refuses every edit until it is reopened with a reason.
      </p>
    </div>
  )
}
