"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Percent, TrendingDown, TrendingUp, Users } from "lucide-react"

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
import type { WeeklyDashboardData } from "@/lib/dashboard"
import { formatMoney, formatMoneyShort, formatMoneyWhole } from "@/lib/format"

const salesChartConfig = {
  sold: {
    label: "Sold (Visit Date)",
    color: "var(--chart-1)",
  },
  collected: {
    label: "Collected (Bank)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const categoryChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function WeeklyView({ data }: { data: WeeklyDashboardData }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: 4 Weekly Numbers KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Weekly sold"
          value={formatMoneyWhole(data.sold)}
          action={
            data.soldDeltaPct !== null ? (
              <Badge
                variant={data.soldDeltaPct >= 0 ? "positive" : "destructive"}
                className="gap-1"
              >
                {data.soldDeltaPct >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {data.soldDeltaPct >= 0 ? "+" : ""}
                {data.soldDeltaPct}%
              </Badge>
            ) : (
              <Badge variant="outline">7 days</Badge>
            )
          }
          footer={
            <span className="truncate">
              Collected {formatMoneyWhole(data.collected)} · {data.salesCount} sales
            </span>
          }
        />

        <KpiCard
          label="Average ticket (AOV)"
          value={data.salesCount > 0 ? formatMoney(data.avgTicket) : "—"}
          action={
            data.aovDeltaPct !== null ? (
              <Badge
                variant={data.aovDeltaPct >= 0 ? "positive" : "destructive"}
                className="gap-1"
              >
                {data.aovDeltaPct >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {data.aovDeltaPct >= 0 ? "+" : ""}
                {data.aovDeltaPct}%
              </Badge>
            ) : (
              <Badge variant="outline">Per sale</Badge>
            )
          }
          footer={
            <span className="truncate">
              Prev 7d sold: {formatMoneyWhole(data.prevSold)}
            </span>
          }
        />

        <KpiCard
          label="New vs. repeat"
          value={`${data.newPatients} / ${data.repeatPatients}`}
          action={<Badge variant="secondary">{data.repeatRevenuePct}% repeat rev.</Badge>}
          footer={
            <>
              <Users className="size-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">Unique patients treated this week</span>
            </>
          }
        />

        <KpiCard
          label="Discounts given"
          value={formatMoneyWhole(data.discountsGiven)}
          action={
            <Badge variant={data.discountPct > 8 ? "destructive" : "outline"}>
              {data.discountPct}% of list
            </Badge>
          }
          footer={
            <>
              <Percent className="size-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">
                List value {formatMoneyWhole(data.listValue)} (ceiling 8%)
              </span>
            </>
          }
        />
      </div>

      {/* Row 2: 2 Real-Numbers Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Sold vs. Collected</CardTitle>
            <CardDescription>
              Sales accrual vs. bank receipts across the last 7 clinic days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={salesChartConfig} className="h-[250px] w-full">
              <BarChart data={data.dailySeries} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
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
                  dataKey="sold"
                  fill="var(--color-sold)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="collected"
                  fill="var(--color-collected)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category (7 days)</CardTitle>
            <CardDescription>
              Weekly revenue performance across clinical verticals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.byCategory.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No sales recorded this week</EmptyTitle>
                  <EmptyDescription>
                    Sales logged in this 7-day window will populate category totals.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ChartContainer config={categoryChartConfig} className="h-[250px] w-full">
                <BarChart data={data.byCategory} accessibilityLayer>
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
                  <Bar
                    dataKey="revenue"
                    fill="var(--color-revenue)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Commercial Mix + First-Visit Acquisition Channels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Tabs defaultValue="category">
            <CardHeader>
              <CardTitle>Commercial Mix</CardTitle>
              <CardDescription>
                Revenue share and average ticket across verticals and catalog kinds.
              </CardDescription>
              <CardAction>
                <TabsList>
                  <TabsTrigger value="category">By Category</TabsTrigger>
                  <TabsTrigger value="kind">By Kind</TabsTrigger>
                </TabsList>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TabsContent value="category" className="flex flex-col gap-4">
                {data.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales in this window.</p>
                ) : (
                  data.byCategory.map((cat) => (
                    <Progress key={cat.category} value={cat.sharePct} className="gap-1.5">
                      <ProgressLabel className="flex items-center gap-2 text-xs">
                        <span>{cat.label}</span>
                        <span className="text-muted-foreground">
                          {cat.salesCount} sales · AOV {formatMoneyWhole(cat.avgTicket)}
                        </span>
                      </ProgressLabel>
                      <ProgressValue className="font-mono text-xs">
                        {() => `${formatMoneyWhole(cat.revenue)} (${cat.sharePct}%)`}
                      </ProgressValue>
                    </Progress>
                  ))
                )}
              </TabsContent>

              <TabsContent value="kind" className="flex flex-col gap-4">
                {data.byKind.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lines in this window.</p>
                ) : (
                  data.byKind.map((k) => (
                    <Progress key={k.kind} value={k.sharePct} className="gap-1.5">
                      <ProgressLabel className="flex items-center gap-2 text-xs">
                        <span>{k.kind}</span>
                        <span className="text-muted-foreground">{k.lines} lines</span>
                      </ProgressLabel>
                      <ProgressValue className="font-mono text-xs">
                        {() => `${formatMoneyWhole(k.revenue)} (${k.sharePct}%)`}
                      </ProgressValue>
                    </Progress>
                  ))
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New Patient Acquisition by Source</CardTitle>
            <CardDescription>
              First-visit patients, revenue and average initial ticket by channel.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.channels.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">
                No first-visit sales recorded in this 7-day window.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Source</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">1st-Visit Rev.</TableHead>
                    <TableHead className="text-right">Avg Ticket</TableHead>
                    <TableHead className="pr-4 text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.channels.map((ch) => (
                    <TableRow key={ch.channel}>
                      <TableCell className="pl-4 font-medium">{ch.channel}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {ch.newPatients}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                        {formatMoneyWhole(ch.firstVisitRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatMoneyWhole(ch.avgFirstTicket)}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {ch.sharePct}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
