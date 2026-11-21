import Link from "next/link"
import { TrendingDown, TrendingUp } from "lucide-react"

import { startExpenseMonth } from "@/app/(app)/expenses/actions"
import { ExpensesCompositionChart } from "@/components/expenses-composition-chart"
import { ExpensesLedgerTabs } from "@/components/expenses-ledger-tabs"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clinicToday } from "@/lib/dates"
import { listExpenseMatrix, listExpenseMonths } from "@/lib/expenses"
import { formatMoneyWhole } from "@/lib/format"

export const dynamic = "force-dynamic"

function monthLabel(period: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${period}T12:00:00`))
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>
}) {
  const params = await searchParams
  const allMonths = await listExpenseMonths()
  const years = Array.from(new Set(allMonths.map((m) => m.period.slice(0, 4)))).sort(
    (a, b) => b.localeCompare(a)
  )
  const rawYear = typeof params.year === "string" ? params.year : ""
  const selectedYear = /^\d{4}$/.test(rawYear) && years.includes(rawYear) ? rawYear : undefined
  const months = selectedYear
    ? allMonths.filter((m) => m.period.startsWith(selectedYear))
    : allMonths

  const matrixRows = await listExpenseMatrix(months.map((m) => m.period))

  const currentPeriod = `${clinicToday().slice(0, 7)}-01`
  const current = months.find((month) => month.period === currentPeriod) ?? months[0]
  const hasCurrent = allMonths.some((month) => month.period === currentPeriod)

  const currentOpPct =
    current && current.netRevenue > 0
      ? Math.round((current.operatingProfit / current.netRevenue) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description="Clinic operating costs separated from physician owner draw and one-time CapEx."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {years.length > 0 ? (
              <div className="inline-flex items-center rounded-lg border bg-card p-0.5 text-xs">
                <Link
                  href="/expenses"
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    !selectedYear
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </Link>
                {years.map((y) => (
                  <Link
                    key={y}
                    href={`/expenses?year=${y}`}
                    className={`rounded-md px-2.5 py-1 font-mono font-medium transition-colors ${
                      selectedYear === y
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {y}
                  </Link>
                ))}
              </div>
            ) : null}
            {hasCurrent ? null : (
              <form
                action={async () => {
                  "use server"
                  await startExpenseMonth(currentPeriod)
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Start {monthLabel(currentPeriod)}
                </Button>
              </form>
            )}
          </div>
        }
      />

      {current ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`Clinic OpEx (${monthLabel(current.period)})`}
            value={formatMoneyWhole(current.clinicOpEx)}
            action={
              <Badge variant="secondary">
                {current.entries} line{current.entries === 1 ? "" : "s"}
              </Badge>
            }
            footer={
              <span className="truncate">
                Fixed {formatMoneyWhole(current.fixed)} · Var/Acq{" "}
                {formatMoneyWhole(current.variable + current.acquisition)}
              </span>
            }
          />

          <KpiCard
            label="Clinic operating profit"
            value={formatMoneyWhole(current.operatingProfit)}
            action={
              <Badge
                variant={current.operatingProfit >= 0 ? "positive" : "destructive"}
                className="gap-1"
              >
                {current.operatingProfit >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {currentOpPct}% op.
              </Badge>
            }
            footer={
              <span className="truncate">
                Net rev {formatMoneyWhole(current.netRevenue)} − clinic OpEx
              </span>
            }
          />

          <KpiCard
            label="Owner draw & CapEx"
            value={formatMoneyWhole(current.ownerDraw + current.capex)}
            action={
              <Badge variant="gold">
                {formatMoneyWhole(current.ownerDraw)} draw
              </Badge>
            }
            footer={
              <span className="truncate">
                {current.capex > 0
                  ? `Includes ${formatMoneyWhole(current.capex)} one-time CapEx`
                  : "Excluded from clinic operating cost"}
              </span>
            }
          />

          <KpiCard
            label="Retained cash"
            value={formatMoneyWhole(current.result)}
            valueClassName={current.result < 0 ? "text-destructive" : undefined}
            action={
              <Badge variant={current.result >= 0 ? "positive" : "destructive"}>
                {current.result >= 0 ? "Surplus" : "Deficit"}
              </Badge>
            }
            footer={
              <span className="truncate">
                After clinic OpEx, owner draw &amp; CapEx
              </span>
            }
          />
        </div>
      ) : null}

      <ExpensesCompositionChart months={months} year={selectedYear} />

      <ExpensesLedgerTabs
        months={months}
        matrixRows={matrixRows}
        selectedYear={selectedYear}
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>How to read this table</CardTitle>
          <CardDescription>
            Quick guide separating true clinic performance from owner payouts and one-time
            investments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Fixed</dt>
              <dd className="text-muted-foreground">
                Rent, staff payroll, insurance, software &amp; recurring clinic bills.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Variable</dt>
              <dd className="text-muted-foreground">
                Clinical supplies, labs &amp; card fees that rise with patient volume.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Acquisition</dt>
              <dd className="text-muted-foreground">
                Ads &amp; marketing consulting invested to bring in new patients.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Clinic OpEx</dt>
              <dd className="text-muted-foreground">
                Fixed + Variable + Acquisition — the true monthly cost to run the clinic.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Op. Profit</dt>
              <dd className="text-muted-foreground">
                Net Revenue minus Clinic OpEx — what the business earns before owner draw.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Owner Draw</dt>
              <dd className="text-muted-foreground">
                Physician distributions paid to the owner, separate from clinic overhead.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">CapEx</dt>
              <dd className="text-muted-foreground">
                One-time purchases of equipment, devices or clinic improvements.
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Retained</dt>
              <dd className="text-muted-foreground">
                Op. Profit minus Owner Draw &amp; CapEx — cash kept in the clinic account.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A closed month keeps the total it had when it was closed; reopening it with a reason
        unlocks the edits.
      </p>
    </div>
  )
}
