import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react"

import { ExpenseEntryDialog } from "@/components/expense-entry-dialog"
import { ExpenseMonthLines } from "@/components/expense-month-lines"
import { KpiCard } from "@/components/kpi-card"
import { MonthStatusActions } from "@/components/month-status-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatClinicDay } from "@/lib/dates"
import {
  getExpenseMonth,
  listExpenseCategories,
  listExpenseItems,
  listSuppliers,
} from "@/lib/expenses"
import { formatMoneyWhole } from "@/lib/format"

export const dynamic = "force-dynamic"

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
  const operatingPct =
    month.netRevenue > 0
      ? Math.round((month.operatingProfit / month.netRevenue) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {monthLabel(month.period)}
            </h1>
            {open ? (
              <Badge variant="gold">Open</Badge>
            ) : (
              <Badge variant="secondary">
                Closed {month.closedAt ? formatClinicDay(month.closedAt.slice(0, 10)) : ""}
              </Badge>
            )}
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
        <KpiCard
          label="Clinic OpEx"
          value={formatMoneyWhole(month.clinicOpEx)}
          action={
            <Badge variant="secondary">
              {month.entries} live line{month.entries === 1 ? "" : "s"}
            </Badge>
          }
          footer={
            <span className="truncate">
              Fixed {formatMoneyWhole(month.fixed)} · Var/Acq{" "}
              {formatMoneyWhole(month.variable + month.acquisition)}
            </span>
          }
        />

        <KpiCard
          label="Clinic operating profit"
          value={formatMoneyWhole(month.operatingProfit)}
          action={
            <Badge
              variant={month.operatingProfit >= 0 ? "positive" : "destructive"}
              className="gap-1"
            >
              {month.operatingProfit >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {operatingPct}% op.
            </Badge>
          }
          footer={
            <span className="truncate">
              Net rev {formatMoneyWhole(month.netRevenue)}
              {month.returned > 0 ? ` (−${formatMoneyWhole(month.returned)} ret.)` : ""}
            </span>
          }
        />

        <KpiCard
          label="Owner draw & CapEx"
          value={formatMoneyWhole(month.ownerDraw + month.capex)}
          action={<Badge variant="gold">{formatMoneyWhole(month.ownerDraw)} draw</Badge>}
          footer={
            <span className="truncate">
              {month.capex > 0
                ? `Includes ${formatMoneyWhole(month.capex)} one-time CapEx`
                : "Separated from operating overhead"}
            </span>
          }
        />

        <KpiCard
          label="Retained cash"
          value={formatMoneyWhole(month.result)}
          valueClassName={month.result < 0 ? "text-destructive" : undefined}
          action={
            <Badge variant={month.result >= 0 ? "positive" : "destructive"}>
              {month.result >= 0 ? "Surplus" : "Deficit"}
            </Badge>
          }
          footer={
            <span className="truncate">
              Total logged {formatMoneyWhole(month.total)}
            </span>
          }
        />
      </div>

      <ExpenseMonthLines
        periodId={month.id}
        period={month.period}
        open={open}
        lines={month.lines}
        items={items}
        suppliers={suppliers}
        categories={categories}
      />

      {month.audit.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Record</span>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {month.audit.map((row, index) => (
              <li key={`${row.changedAt}-${index}`}>
                {formatClinicDay(row.changedAt.slice(0, 10))} · {row.oldStatus} →{" "}
                {row.newStatus} · {row.reason}
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
