"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertCircle,
  Info,
  MessageSquare,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MonthlyDashboardData } from "@/lib/dashboard"
import { formatMoneyShort, formatMoneyWhole, formatPercent } from "@/lib/format"

type TrendMode = "money" | "pl" | "retention"

const trendConfigs: Record<TrendMode, ChartConfig> = {
  money: {
    grossRevenue: { label: "Gross Sold", color: "var(--chart-1)" },
    collected: { label: "Collected (Bank)", color: "var(--chart-2)" },
    expenses: { label: "Expenses", color: "var(--chart-5)" },
  },
  pl: {
    grossRevenue: { label: "Revenue", color: "var(--chart-1)" },
    grossMargin: { label: "Gross Margin", color: "var(--chart-3)" },
    cashResult: { label: "Net After Expenses", color: "var(--chart-2)" },
  },
  retention: {
    repeatRevenue: { label: "Repeat Patients", color: "var(--chart-1)" },
    newRevenue: { label: "New Patients", color: "var(--chart-2)" },
  },
}

const expenseColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
]

const expenseChartConfig = {
  amount: { label: "Expense" },
} satisfies ChartConfig

const stripeChartConfig = {
  expected: { label: "Expected (Pending)", color: "var(--chart-1)" },
  stripeCollected: { label: "Stripe Collected", color: "var(--chart-3)" },
  overdue: { label: "Overdue", color: "var(--chart-5)" },
} satisfies ChartConfig

function digitsOnly(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return null
  return digits.length === 10 ? `1${digits}` : digits
}

export function MonthlyView({ data }: { data: MonthlyDashboardData }) {
  const [trendMode, setTrendMode] = useState<TrendMode>("money")

  const breakEvenRevenue =
    data.grossMarginPct && data.grossMarginPct > 0 && data.recurringFixedExpenses > 0
      ? Math.round(data.recurringFixedExpenses / (data.grossMarginPct / 100))
      : 0
  const breakEvenPct =
    breakEvenRevenue > 0
      ? Math.min(100, Math.round((data.netRevenue / breakEvenRevenue) * 100))
      : 0

  const operatingPct =
    data.netRevenue > 0
      ? Math.round((data.clinicOperatingProfit / data.netRevenue) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
      {data.costCoveragePct < 99.5 && data.grossRevenue > 0 ? (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>
            Cost coverage at {data.costCoveragePct}% (honest margin guard)
          </AlertTitle>
          <AlertDescription>
            Gross margin is calculated strictly on items with confirmed cost lists so
            unpriced retail products never inflate profitability.{" "}
            <Link href="/catalog/products" className="underline underline-offset-4">
              Review catalog costs
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Row 1: 4 Executive KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Net revenue"
          value={formatMoneyWhole(data.netRevenue)}
          action={
            data.netRevenueDeltaPct !== null ? (
              <Badge
                variant={data.netRevenueDeltaPct >= 0 ? "positive" : "destructive"}
                className="gap-1"
              >
                {data.netRevenueDeltaPct >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {data.netRevenueDeltaPct >= 0 ? "+" : ""}
                {data.netRevenueDeltaPct}%
              </Badge>
            ) : (
              <Badge variant="secondary">
                {data.periodStatus === "closed"
                  ? "Closed"
                  : data.periodStatus === "open"
                    ? "Open"
                    : "Active"}
              </Badge>
            )
          }
          footer={
            <span className="truncate">
              Gross {formatMoneyWhole(data.grossRevenue)} · −
              {formatMoneyWhole(data.returned)} ret.
            </span>
          }
        />

        <KpiCard
          label="Gross margin"
          value={formatMoneyWhole(data.grossMargin)}
          action={
            <Badge variant="secondary">
              {formatPercent(data.grossMarginPct)}
              {data.grossMarginDeltaPts !== null
                ? ` (${data.grossMarginDeltaPts >= 0 ? "+" : ""}${data.grossMarginDeltaPts})`
                : ""}
            </Badge>
          }
          footer={
            <span className="truncate">
              COGS {formatMoneyWhole(data.cogs)} · {data.costCoveragePct}% costed
            </span>
          }
        />

        <KpiCard
          label="Clinic operating profit"
          value={formatMoneyWhole(data.clinicOperatingProfit)}
          action={
            <Tooltip>
              <TooltipTrigger
                render={<span tabIndex={0} className="inline-flex cursor-help" />}
              >
                <Badge
                  variant={data.clinicOperatingProfit >= 0 ? "positive" : "destructive"}
                  className="gap-1"
                >
                  {data.clinicOperatingProfit >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {operatingPct}% op.
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Net revenue minus clinic operating costs (before Owner draw of{" "}
                {formatMoneyWhole(data.ownerDraw)} and one-time CapEx of{" "}
                {formatMoneyWhole(data.capexExpenses)}).
              </TooltipContent>
            </Tooltip>
          }
          footer={
            <span className="truncate">
              Owner draw {formatMoneyWhole(data.ownerDraw)} · Retained{" "}
              {formatMoneyWhole(data.cashResult)}
            </span>
          }
        />

        <KpiCard
          label="CAC (Ad / Blended)"
          value={
            <>
              {data.cacAdOnly !== null ? formatMoneyWhole(data.cacAdOnly) : "—"}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                / {data.cacBlended !== null ? formatMoneyWhole(data.cacBlended) : "—"}
              </span>
            </>
          }
          action={
            <Tooltip>
              <TooltipTrigger
                render={<span tabIndex={0} className="inline-flex cursor-help" />}
              >
                <Badge variant="outline">
                  {data.roasNew !== null ? `${data.roasNew}x ROAS` : "No ad spend"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Ad-only CAC uses Meta spend ({formatMoneyWhole(data.adSpend)}). Blended
                CAC adds marketing consulting ({formatMoneyWhole(data.marketingConsulting)}
                ) across {data.newPatients} new patients.
              </TooltipContent>
            </Tooltip>
          }
          footer={
            <span className="truncate">
              {data.newPatients} new · {data.repeatVisits} repeat visits
            </span>
          }
        />
      </div>

      {/* Row 2: 6-Month Financial Pulse */}
      <Card>
        <CardHeader>
          <CardTitle>6-Month Financial Pulse</CardTitle>
          <CardDescription>
            Compare cash lanes, unit-economics margin, and repeat revenue mix (goal ≥ 50%
            repeat).
          </CardDescription>
          <CardAction>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[trendMode]}
              onValueChange={(next) => {
                const picked = next[0] as TrendMode | undefined
                if (picked) setTrendMode(picked)
              }}
            >
              <ToggleGroupItem value="money">Revenue vs Cash</ToggleGroupItem>
              <ToggleGroupItem value="pl">P&amp;L &amp; Margin</ToggleGroupItem>
              <ToggleGroupItem value="retention">New vs Repeat</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={trendConfigs[trendMode]}
            className="h-[280px] w-full"
          >
            {trendMode === "retention" ? (
              <BarChart data={data.sixMonthTrend} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoneyShort(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(value) => formatMoneyWhole(value)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="repeatRevenue"
                  stackId="rev"
                  fill="var(--color-repeatRevenue)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="newRevenue"
                  stackId="rev"
                  fill="var(--color-newRevenue)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            ) : (
              <AreaChart data={data.sixMonthTrend} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoneyShort(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(value) => formatMoneyWhole(value)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {trendMode === "money" ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="grossRevenue"
                      stroke="var(--color-grossRevenue)"
                      fill="var(--color-grossRevenue)"
                      fillOpacity={0.16}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="collected"
                      stroke="var(--color-collected)"
                      fill="var(--color-collected)"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="var(--color-expenses)"
                      fill="var(--color-expenses)"
                      fillOpacity={0.07}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </>
                ) : (
                  <>
                    <Area
                      type="monotone"
                      dataKey="grossRevenue"
                      stroke="var(--color-grossRevenue)"
                      fill="var(--color-grossRevenue)"
                      fillOpacity={0.12}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="grossMargin"
                      stroke="var(--color-grossMargin)"
                      fill="var(--color-grossMargin)"
                      fillOpacity={0.16}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="cashResult"
                      stroke="var(--color-cashResult)"
                      fill="var(--color-cashResult)"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </>
                )}
              </AreaChart>
            )}
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Row 3: Profitability + Expenses & Break-Even */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <Tabs defaultValue="category" className="flex flex-1 flex-col">
            <CardHeader>
              <CardTitle>Profitability Breakdown</CardTitle>
              <CardDescription>
                Unit-economics margin by clinical vertical and top items for the month.
              </CardDescription>
              <CardAction>
                <TabsList>
                  <TabsTrigger value="category">By Category</TabsTrigger>
                  <TabsTrigger value="items">Top Items</TabsTrigger>
                </TabsList>
              </CardAction>
            </CardHeader>
            <CardContent className="flex-1 px-0">
              <TabsContent value="category">
                {data.profitabilityByCategory.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">
                    No category sales recorded in this month.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Category</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Margin $</TableHead>
                        <TableHead className="pr-4 text-right">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.profitabilityByCategory.map((row) => (
                        <TableRow key={row.category}>
                          <TableCell className="pl-4 font-medium">{row.label}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMoneyWhole(row.revenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {formatMoneyWhole(row.cost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                            {formatMoneyWhole(row.margin)}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <Badge variant="secondary" className="font-mono">
                              {formatPercent(row.marginPct)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="items">
                {data.topItems.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">
                    No item sales recorded in this month.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Item</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Margin $</TableHead>
                        <TableHead className="pr-4 text-right">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topItems.map((row) => (
                        <TableRow key={row.itemId}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className="truncate">{row.itemName}</span>
                              {!row.costKnown ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <span
                                        tabIndex={0}
                                        className="inline-flex cursor-help"
                                      />
                                    }
                                  >
                                    <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Missing confirmed cost list for this item.
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </div>
                            <div className="text-xs capitalize text-muted-foreground">
                              {row.kind}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {row.units}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMoneyWhole(row.revenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                            {formatMoneyWhole(row.margin)}
                          </TableCell>
                          <TableCell className="pr-4 text-right font-mono text-xs tabular-nums">
                            {formatPercent(row.marginPct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </CardContent>
            <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
              <span>
                Discounts this month: {formatMoneyWhole(data.discountTotal)} (
                {data.discountPct}% of list)
              </span>
              <Link href="/reports" className="underline underline-offset-4">
                Full executive report
              </Link>
            </CardFooter>
          </Tabs>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Expenses &amp; Break-Even</CardTitle>
            <CardDescription>
              Operating expense breakdown and pure fixed-overhead coverage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            {data.expensesByCategory.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No expenses recorded</EmptyTitle>
                  <EmptyDescription>
                    Log monthly expenses in{" "}
                    <Link href="/expenses" className="underline underline-offset-4">
                      Expenses
                    </Link>{" "}
                    to track category shares and break-even.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <ChartContainer
                  config={expenseChartConfig}
                  className="mx-auto h-[180px] w-full max-w-[240px]"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          valueFormatter={(value) => formatMoneyWhole(value)}
                        />
                      }
                    />
                    <Pie
                      data={data.expensesByCategory}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius={48}
                      outerRadius={76}
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {data.expensesByCategory.map((entry, idx) => (
                        <Cell
                          key={entry.category}
                          fill={expenseColors[idx % expenseColors.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {data.expensesByCategory.map((e, idx) => (
                    <div
                      key={e.category}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: expenseColors[idx % expenseColors.length],
                          }}
                        />
                        <span className="truncate">{e.label}</span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatMoneyWhole(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="mt-auto flex-col items-stretch gap-3">
            {data.ownerDraw > 0 || data.capexExpenses > 0 ? (
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                <div>
                  <div className="text-[11px] text-muted-foreground">Clinic profit</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">
                    {formatMoneyWhole(data.clinicOperatingProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Owner draw</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">
                    −{formatMoneyWhole(data.ownerDraw)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Retained</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">
                    {formatMoneyWhole(data.cashResult)}
                  </div>
                </div>
              </div>
            ) : null}
            <Progress value={breakEvenPct} className="gap-1.5">
              <ProgressLabel className="text-xs">
                Break-Even{" "}
                {breakEvenRevenue > 0 ? `(${formatMoneyWhole(breakEvenRevenue)})` : ""}
              </ProgressLabel>
              <ProgressValue className="font-mono text-xs">
                {() => (breakEvenRevenue > 0 ? `${breakEvenPct}% reached` : "—")}
              </ProgressValue>
            </Progress>
            <p className="text-[11px] text-muted-foreground">
              Fixed overhead ({formatMoneyWhole(data.recurringFixedExpenses)}) ÷{" "}
              {formatPercent(data.grossMarginPct)} gross margin (excludes owner draw &amp;
              variable COGS).
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Row 4: Stripe Forecast + Reactivation Watchlist */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stripe Installment Forecast &amp; Risk</CardTitle>
            <CardDescription>
              Upcoming pending installments vs. Stripe receipts collected.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">
                {data.instantCollectedPct}% instant settled
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            {data.stripeForecast.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No pending installments</EmptyTitle>
                  <EmptyDescription>
                    All upcoming installment plans are currently settled.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ChartContainer config={stripeChartConfig} className="h-[220px] w-full">
                <BarChart data={data.stripeForecast} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatMoneyShort(Number(v))}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        valueFormatter={(value) => formatMoneyWhole(value)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="expected"
                    fill="var(--color-expected)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="stripeCollected"
                    fill="var(--color-stripeCollected)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="overdue"
                    fill="var(--color-overdue)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
          <CardFooter className="mt-auto text-xs text-muted-foreground">
            <ShieldAlert className="mr-1.5 size-3.5 shrink-0 text-sidebar-primary" />
            <span className="truncate">
              {data.installmentRiskPct}% of this month&apos;s receipts came through Stripe
              installments.
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reactivation Watchlist (60–120 days)</CardTitle>
            <CardDescription>
              High-LTV patients in the aesthetic maintenance recall window.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 px-0">
            {data.reactivationWatchlist.length === 0 ? (
              <div className="px-4 py-4">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No patients in the 60–120 day window</EmptyTitle>
                    <EmptyDescription>
                      Returning patients appear here once 60 days pass since their last
                      visit.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Patient</TableHead>
                    <TableHead>Last Treatment</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Contact</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.reactivationWatchlist.map((pat) => {
                    const wa = digitsOnly(pat.phone)
                    return (
                      <TableRow key={pat.id}>
                        <TableCell className="pl-4">
                          <Link
                            href={`/patients/${pat.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {pat.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {pat.visits} visit{pat.visits === 1 ? "" : "s"}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                          {pat.lastItem ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono">
                            {pat.daysSinceLastVisit}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                          {formatMoneyWhole(pat.spentTotal)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {wa ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              nativeButton={false}
                              render={
                                <a
                                  href={`https://wa.me/${wa}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`WhatsApp ${pat.name}`}
                                />
                              }
                            >
                              <MessageSquare className="size-3.5" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
