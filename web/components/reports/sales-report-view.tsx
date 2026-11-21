"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts"

import { KpiCard } from "@/components/kpi-card"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import { formatMoney, formatMoneyShort, formatMoneyWhole } from "@/lib/format"
import type { SalesReportData } from "@/lib/reports"

type TrendMode = "cash" | "retention"
type WeekdayMetric = "revenue" | "avgDailyRevenue" | "avgTicket"

const trendCashConfig = {
  sold: { label: "Sold (Booked)", color: "var(--chart-1)" },
  collected: { label: "Collected (Bank)", color: "var(--chart-3)" },
} satisfies ChartConfig

const trendRetentionConfig = {
  repeatRevenue: { label: "Repeat Patients", color: "var(--chart-2)" },
  newRevenue: { label: "New Patients", color: "var(--chart-1)" },
} satisfies ChartConfig

const weekdayConfig = {
  revenue: { label: "Total Revenue", color: "var(--chart-1)" },
  avgDailyRevenue: { label: "Avg / Active Day", color: "var(--chart-1)" },
  avgTicket: { label: "Avg Ticket (AOV)", color: "var(--chart-1)" },
} satisfies ChartConfig

const categoryConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const kindConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const paymentConfig = {
  collected: { label: "Collected", color: "var(--chart-3)" },
} satisfies ChartConfig

const sourceConfig = {
  revenue: { label: "1st-Visit Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const clinicPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
]

export function SalesReportView({
  data,
  mode,
}: {
  data: SalesReportData
  mode: "all" | "day" | "range"
}) {
  const [trendMode, setTrendMode] = useState<TrendMode>("cash")
  const [weekdayMetric, setWeekdayMetric] = useState<WeekdayMetric>("revenue")

  const newSharePct =
    data.salesCount > 0 ? Math.round((data.newSalesCount / data.salesCount) * 100) : 0
  const repeatRevPct =
    data.sold > 0 ? Math.round((data.repeatSalesRevenue / data.sold) * 100) : 0

  const peakWeekday = useMemo(() => {
    const active = data.byDayOfWeek.filter((d) => d.revenue > 0)
    if (active.length === 0) return null
    return active.reduce((best, cur) =>
      cur[weekdayMetric] > best[weekdayMetric] ? cur : best
    )
  }, [data.byDayOfWeek, weekdayMetric])

  const peakRevenueDay = useMemo(() => {
    const active = data.byDayOfWeek.filter((d) => d.revenue > 0)
    if (active.length === 0) return null
    return active.reduce((best, cur) =>
      cur.avgDailyRevenue > best.avgDailyRevenue ? cur : best
    )
  }, [data.byDayOfWeek])

  const granularityLabel =
    data.trendGranularity === "day"
      ? "Daily"
      : data.trendGranularity === "week"
        ? "Weekly"
        : "Monthly"

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Executive KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total sold"
          value={formatMoneyWhole(data.sold)}
          action={
            <Badge
              variant={data.collectionRatioPct >= 90 ? "positive" : "gold"}
            >
              {data.collectionRatioPct}% collected
            </Badge>
          }
          footer={
            <span className="truncate">
              Bank {formatMoneyWhole(data.collected)} · {data.salesCount} sales
            </span>
          }
        />

        <KpiCard
          label="Average ticket (AOV)"
          value={data.salesCount > 0 ? formatMoney(data.avgTicket) : "—"}
          action={
            <Badge variant="secondary">
              {data.avgLinesPerSale} items/sale
            </Badge>
          }
          footer={
            <span className="truncate">
              New {formatMoneyWhole(data.newAvgTicket)} · Repeat{" "}
              {formatMoneyWhole(data.repeatAvgTicket)}
            </span>
          }
        />

        <KpiCard
          label="New vs. repeat"
          value={`${data.newSalesCount} / ${data.repeatSalesCount}`}
          action={
            <Badge variant={repeatRevPct >= 50 ? "positive" : "outline"}>
              {repeatRevPct}% repeat rev.
            </Badge>
          }
          footer={
            <span className="truncate">
              {data.salesCount === 0
                ? "No visits in period"
                : `${newSharePct}% new · ${100 - newSharePct}% repeat visits`}
            </span>
          }
        />

        <KpiCard
          label="Discounts given"
          value={formatMoneyWhole(data.discountTotal)}
          action={
            <Badge variant={data.discountPct > 8 ? "destructive" : "positive"}>
              {data.discountPct}% of list
            </Badge>
          }
          footer={
            <span className="truncate">
              List value {formatMoneyWhole(data.listValue)} (ceiling 8%)
            </span>
          }
        />
      </div>

      {/* 1-Line Deterministic Commercial Brief */}
      {data.salesCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-l-2 border-l-sidebar-primary bg-accent/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">
              Commercial brief:
            </strong>{" "}
            {peakRevenueDay ? (
              <>
                Strongest clinic day is{" "}
                <span className="font-medium text-foreground">
                  {peakRevenueDay.label}
                </span>{" "}
                (
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {formatMoneyWhole(peakRevenueDay.avgDailyRevenue)}/day
                </span>{" "}
                avg);{" "}
              </>
            ) : null}
            top{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {Math.min(5, data.topItems.length)}
            </span>{" "}
            items generate{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {data.top5SharePct}%
            </span>{" "}
            of revenue ({data.pareto80Count} items = 80% Pareto); bank receipts
            tracking at{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {data.collectionRatioPct}%
            </span>{" "}
            of booked sales.
          </span>
        </div>
      ) : null}

      {/* 3 Editorial Tabs */}
      <Tabs defaultValue="trends" className="gap-6">
        <div className="border-b">
          <TabsList variant="line">
            <TabsTrigger value="trends">Trends &amp; Cadence</TabsTrigger>
            <TabsTrigger value="mix">Commercial Mix</TabsTrigger>
            <TabsTrigger value="payments">Payments &amp; Acquisition</TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: TRENDS & CADENCE */}
        <TabsContent value="trends" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{granularityLabel} Sales Trajectory</CardTitle>
              <CardDescription>
                {trendMode === "cash"
                  ? "Booked sales revenue vs. actual bank receipts across the selected window."
                  : "Booked revenue split between first-visit and returning patients."}
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
                  <ToggleGroupItem value="cash">Sold vs. Collected</ToggleGroupItem>
                  <ToggleGroupItem value="retention">New vs. Repeat</ToggleGroupItem>
                </ToggleGroup>
              </CardAction>
            </CardHeader>
            <CardContent>
              {mode === "day" || data.trend.length < 2 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Select a multi-day window to view trends</EmptyTitle>
                    <EmptyDescription>
                      Pick 30D, 90D, YTD, All, or a custom date range to plot sales
                      trajectory over time.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : trendMode === "cash" ? (
                <ChartContainer
                  config={trendCashConfig}
                  className="h-[260px] w-full"
                >
                  <AreaChart data={data.trend} accessibilityLayer>
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
                          valueFormatter={(v) => formatMoneyWhole(v)}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="sold"
                      stroke="var(--color-sold)"
                      fill="var(--color-sold)"
                      fillOpacity={0.16}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="collected"
                      stroke="var(--color-collected)"
                      fill="var(--color-collected)"
                      fillOpacity={0.12}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <ChartContainer
                  config={trendRetentionConfig}
                  className="h-[260px] w-full"
                >
                  <BarChart data={data.trend} accessibilityLayer>
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
                          valueFormatter={(v) => formatMoneyWhole(v)}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="repeatRevenue"
                      fill="var(--color-repeatRevenue)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="newRevenue"
                      fill="var(--color-newRevenue)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Day-of-Week Consolidation */}
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Sales Consolidation by Day of Week</CardTitle>
                <CardDescription>
                  Identify peak clinic days vs. slower weekdays for scheduling and
                  recall campaigns.
                </CardDescription>
                <CardAction>
                  <ToggleGroup
                    variant="outline"
                    size="sm"
                    spacing={0}
                    value={[weekdayMetric]}
                    onValueChange={(next) => {
                      const picked = next[0] as WeekdayMetric | undefined
                      if (picked) setWeekdayMetric(picked)
                    }}
                  >
                    <ToggleGroupItem value="revenue">Total</ToggleGroupItem>
                    <ToggleGroupItem value="avgDailyRevenue">Avg/Day</ToggleGroupItem>
                    <ToggleGroupItem value="avgTicket">AOV</ToggleGroupItem>
                  </ToggleGroup>
                </CardAction>
              </CardHeader>
              <CardContent>
                {mode === "day" || data.salesCount === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Not enough days to compare weekdays</EmptyTitle>
                      <EmptyDescription>
                        Switch to 30D, 90D, YTD or All to compare Monday–Saturday
                        performance.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer
                    config={weekdayConfig}
                    className="h-[240px] w-full"
                  >
                    <BarChart data={data.byDayOfWeek} accessibilityLayer>
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
                            valueFormatter={(v) => formatMoneyWhole(v)}
                          />
                        }
                      />
                      <Bar
                        dataKey={weekdayMetric}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      >
                        {data.byDayOfWeek.map((entry) => (
                          <Cell
                            key={entry.dow}
                            fill={
                              peakWeekday && entry.dow === peakWeekday.dow
                                ? "var(--chart-1)"
                                : "var(--chart-2)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Weekday Scorecard</CardTitle>
                <CardDescription>
                  Volume, average ticket and daily pace per clinic weekday.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {data.salesCount === 0 ? (
                  <div className="px-4 py-6">
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No sales in period</EmptyTitle>
                        <EmptyDescription>
                          Weekday stats populate once sales are logged.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Day</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Avg/Day</TableHead>
                        <TableHead className="text-right">AOV</TableHead>
                        <TableHead className="pr-4 text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byDayOfWeek.map((row) => {
                        const isPeak = peakWeekday && row.dow === peakWeekday.dow
                        return (
                          <TableRow key={row.dow}>
                            <TableCell className="pl-4">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span>{row.label}</span>
                                {isPeak ? (
                                  <Badge variant="gold" className="text-[10px]">
                                    Peak
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {row.salesCount}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                              {formatMoneyWhole(row.avgDailyRevenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                              {row.salesCount > 0
                                ? formatMoneyWhole(row.avgTicket)
                                : "—"}
                            </TableCell>
                            <TableCell className="pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
                              {row.sharePct}%
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
        </TabsContent>

        {/* TAB 2: COMMERCIAL MIX */}
        <TabsContent value="mix" className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Clinical Category</CardTitle>
                <CardDescription>
                  Revenue concentration across the four clinical verticals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.byCategory.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No category sales</EmptyTitle>
                      <EmptyDescription>
                        No sales lines recorded in this period.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer
                    config={categoryConfig}
                    className="h-[220px] w-full"
                  >
                    <BarChart
                      data={data.byCategory}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                      accessibilityLayer
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatMoneyShort(Number(v))}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        width={116}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            valueFormatter={(v) => formatMoneyWhole(v)}
                          />
                        }
                      />
                      <Bar
                        dataKey="revenue"
                        radius={[0, 3, 3, 0]}
                        isAnimationActive={false}
                      >
                        {data.byCategory.map((entry, idx) => (
                          <Cell
                            key={entry.label}
                            fill={clinicPalette[idx % clinicPalette.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Catalog Kind</CardTitle>
                <CardDescription>
                  Treatments, packages, memberships, products and services.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.byKind.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No lines in period</EmptyTitle>
                      <EmptyDescription>
                        Catalog kind distribution appears once items are sold.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer config={kindConfig} className="h-[220px] w-full">
                    <BarChart
                      data={data.byKind}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                      accessibilityLayer
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatMoneyShort(Number(v))}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        width={96}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            valueFormatter={(v) => formatMoneyWhole(v)}
                          />
                        }
                      />
                      <Bar
                        dataKey="revenue"
                        radius={[0, 3, 3, 0]}
                        isAnimationActive={false}
                      >
                        {data.byKind.map((entry, idx) => (
                          <Cell
                            key={entry.label}
                            fill={idx === 0 ? "var(--chart-1)" : "var(--chart-2)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Top Revenue Drivers (Pareto 80/20)</CardTitle>
                <CardDescription>
                  Highest-grossing treatments, packages and products in the period.
                </CardDescription>
                {data.topItems.length > 0 ? (
                  <CardAction>
                    <Badge variant="gold">
                      Top {Math.min(5, data.topItems.length)} = {data.top5SharePct}%
                    </Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="px-0">
                {data.topItems.length === 0 ? (
                  <div className="px-4 py-6">
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No items sold in period</EmptyTitle>
                        <EmptyDescription>
                          Top revenue drivers appear once sales lines are recorded.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Item</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                        <TableHead className="pr-4 text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topItems.map((row) => (
                        <TableRow key={`${row.kind}-${row.itemName}`}>
                          <TableCell className="pl-4">
                            <div className="font-medium">{row.itemName}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.kind} · {row.category}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {row.units}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {row.sharePct}%
                          </TableCell>
                          <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums">
                            {formatMoneyWhole(row.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Discount Leakage by Item</CardTitle>
                <CardDescription>
                  Items sold below frozen list price during this period.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {data.topDiscounted.length === 0 ? (
                  <div className="px-4 py-6">
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Zero discount leakage</EmptyTitle>
                        <EmptyDescription>
                          Every item in this period sold at full list price.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Item</TableHead>
                        <TableHead className="text-right">Lines</TableHead>
                        <TableHead className="text-right">Off %</TableHead>
                        <TableHead className="pr-4 text-right">Discount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topDiscounted.map((row) => (
                        <TableRow key={row.itemName}>
                          <TableCell className="max-w-[180px] truncate pl-4 font-medium">
                            {row.itemName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {row.lines}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                row.discountPct > 10 ? "destructive" : "secondary"
                              }
                              className="font-mono text-[10px]"
                            >
                              {row.discountPct}%
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-4 text-right font-mono text-xs font-medium tabular-nums">
                            −{formatMoneyWhole(row.discount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: PAYMENTS & ACQUISITION */}
        <TabsContent value="payments" className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Collected by Payment Method</CardTitle>
              <CardDescription>
                Actual bank receipts grouped by tender in this period.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-0">
              {data.byPaymentMethod.length === 0 ? (
                <div className="px-4 py-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No receipts in this period</EmptyTitle>
                      <EmptyDescription>
                        Collected payments grouped by method will appear here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <>
                  <div className="px-4">
                    <ChartContainer
                      config={paymentConfig}
                      className="h-[190px] w-full"
                    >
                      <BarChart
                        data={data.byPaymentMethod}
                        layout="vertical"
                        margin={{ left: 4, right: 12 }}
                        accessibilityLayer
                      >
                        <CartesianGrid horizontal={false} />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatMoneyShort(Number(v))}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          width={96}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              valueFormatter={(v) => formatMoneyWhole(v)}
                            />
                          }
                        />
                        <Bar
                          dataKey="collected"
                          radius={[0, 3, 3, 0]}
                          isAnimationActive={false}
                        >
                          {data.byPaymentMethod.map((entry, idx) => (
                            <Cell
                              key={entry.label}
                              fill={idx === 0 ? "var(--chart-3)" : "var(--chart-2)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Method</TableHead>
                        <TableHead className="text-right">Receipts</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                        <TableHead className="pr-4 text-right">Collected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byPaymentMethod.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell className="pl-4 font-medium">
                            {row.label}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {row.receipts}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {row.sharePct}%
                          </TableCell>
                          <TableCell className="pr-4 text-right font-mono text-xs font-medium tabular-nums">
                            {formatMoney(row.collected)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>First-Visit Acquisition Sources</CardTitle>
              <CardDescription>
                New patients and first-visit booked revenue by acquisition channel.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-0">
              {data.bySourceFirstVisit.length === 0 ? (
                <div className="px-4 py-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No first visits in this period</EmptyTitle>
                      <EmptyDescription>
                        New patient acquisition sources will appear here once
                        recorded.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <>
                  <div className="px-4">
                    <ChartContainer
                      config={sourceConfig}
                      className="h-[190px] w-full"
                    >
                      <BarChart
                        data={data.bySourceFirstVisit}
                        layout="vertical"
                        margin={{ left: 4, right: 12 }}
                        accessibilityLayer
                      >
                        <CartesianGrid horizontal={false} />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatMoneyShort(Number(v))}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          width={108}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              valueFormatter={(v) => formatMoneyWhole(v)}
                            />
                          }
                        />
                        <Bar
                          dataKey="revenue"
                          radius={[0, 3, 3, 0]}
                          isAnimationActive={false}
                        >
                          {data.bySourceFirstVisit.map((entry, idx) => (
                            <Cell
                              key={entry.label}
                              fill={idx === 0 ? "var(--chart-1)" : "var(--chart-2)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Source</TableHead>
                        <TableHead className="text-right">New Patients</TableHead>
                        <TableHead className="text-right">Avg 1st Visit</TableHead>
                        <TableHead className="pr-4 text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.bySourceFirstVisit.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell className="pl-4 font-medium">
                            {row.label}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {row.newPatients}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {formatMoneyWhole(
                              row.newPatients > 0
                                ? row.revenue / row.newPatients
                                : 0
                            )}
                          </TableCell>
                          <TableCell className="pr-4 text-right font-mono text-xs font-medium tabular-nums">
                            {formatMoneyWhole(row.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
