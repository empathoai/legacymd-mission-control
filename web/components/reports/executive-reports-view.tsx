"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertCircle,
  ArrowRight,
  Download,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatMoney,
  formatMoneyShort,
  formatMoneyWhole,
  formatPercent,
} from "@/lib/format"
import type { BoardMonthRow, ExecutiveReportData } from "@/lib/reports"

type WindowKey = "3m" | "6m" | "all"
type ItemSortKey = "margin" | "marginPct" | "units"

const pnlChartConfig = {
  operatingProfit: { label: "Operating Profit", color: "var(--chart-1)" },
  ownerDraw: { label: "Owner Draw", color: "var(--chart-2)" },
  retainedCash: { label: "Retained Cash", color: "var(--chart-3)" },
} satisfies ChartConfig

const categoryChartConfig = {
  margin: { label: "Net Margin", color: "var(--chart-1)" },
} satisfies ChartConfig

const acqChartConfig = {
  firstVisitRevenue: { label: "1st-Visit Revenue", color: "var(--chart-1)" },
  acquisitionExpenses: { label: "Acq. Spend (Ads + Agency)", color: "var(--chart-2)" },
} satisfies ChartConfig

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((cols) =>
      cols
        .map((c) => {
          const s = String(c ?? "")
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(",")
    )
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExecutiveReportsView({ data }: { data: ExecutiveReportData }) {
  const hasClosed = data.monthlyBoard.some((m) => m.status === "closed")
  const [windowKey, setWindowKey] = useState<WindowKey>("6m")
  const [closedOnly, setClosedOnly] = useState<boolean>(hasClosed)
  const [selectedMonthRow, setSelectedMonthRow] = useState<BoardMonthRow | null>(null)

  // Unit Economics table controls
  const [itemQuery, setItemQuery] = useState("")
  const [kindFilter, setKindFilter] = useState<string>("all")
  const [itemSort, setItemSort] = useState<ItemSortKey>("margin")

  // Filtered months (chronological ascending for charts, reversed for ledger)
  const filteredMonths = useMemo(() => {
    const base = closedOnly
      ? data.monthlyBoard.filter((m) => m.status === "closed")
      : data.monthlyBoard
    if (windowKey === "3m") return base.slice(-3)
    if (windowKey === "6m") return base.slice(-6)
    return base
  }, [data.monthlyBoard, closedOnly, windowKey])

  const activeMonthSet = useMemo(
    () => new Set(filteredMonths.map((m) => m.month)),
    [filteredMonths]
  )

  // Cumulative KPIs across active filtered months
  const summary = useMemo(() => {
    const count = filteredMonths.length
    const netRevenue = filteredMonths.reduce((s, m) => s + m.netRevenue, 0)
    const collected = filteredMonths.reduce((s, m) => s + m.collected, 0)
    const clinicOpEx = filteredMonths.reduce((s, m) => s + m.clinicOpEx, 0)
    const operatingProfit = filteredMonths.reduce((s, m) => s + m.operatingProfit, 0)
    const ownerDraw = filteredMonths.reduce((s, m) => s + m.ownerDraw, 0)
    const capex = filteredMonths.reduce((s, m) => s + m.capex, 0)
    const retainedCash = filteredMonths.reduce((s, m) => s + m.retainedCash, 0)
    const adSpend = filteredMonths.reduce((s, m) => s + m.adSpend, 0)
    const consultingSpend = filteredMonths.reduce((s, m) => s + m.consultingSpend, 0)
    const acqTotal = filteredMonths.reduce((s, m) => s + m.acquisitionExpenses, 0)
    const newPatients = filteredMonths.reduce((s, m) => s + m.newPatients, 0)
    const firstVisitRevenue = filteredMonths.reduce((s, m) => s + m.firstVisitRevenue, 0)
    const revWithCost = filteredMonths.reduce((s, m) => s + m.revenueWithCost, 0)
    const grossMargin = filteredMonths.reduce((s, m) => s + m.grossMargin, 0)

    return {
      count,
      netRevenue,
      collected,
      collectionPct: netRevenue > 0 ? round1((collected / netRevenue) * 100) : 0,
      clinicOpEx,
      operatingProfit,
      operatingMarginPct: netRevenue > 0 ? round1((operatingProfit / netRevenue) * 100) : 0,
      ownerDraw,
      drawCoverage: ownerDraw > 0 ? round1(operatingProfit / ownerDraw) : null,
      capex,
      retainedCash,
      adSpend,
      consultingSpend,
      acqTotal,
      newPatients,
      firstVisitRevenue,
      adCac: newPatients > 0 && adSpend > 0 ? adSpend / newPatients : null,
      blendedCac: newPatients > 0 && acqTotal > 0 ? acqTotal / newPatients : null,
      blendedRoas: acqTotal > 0 ? round1(firstVisitRevenue / acqTotal) : null,
      avgGrossMarginPct: revWithCost > 0 ? (grossMargin / revWithCost) * 100 : null,
    }
  }, [filteredMonths])

  // Aggregated Categories over active months
  const aggregatedCategories = useMemo(() => {
    const map = new Map<
      string,
      { label: string; lines: number; revenue: number; revenueWithCost: number; cost: number; margin: number }
    >()
    for (const r of data.categoryMonthly) {
      if (!activeMonthSet.has(r.month)) continue
      const entry = map.get(r.category) ?? {
        label: r.label,
        lines: 0,
        revenue: 0,
        revenueWithCost: 0,
        cost: 0,
        margin: 0,
      }
      entry.lines += r.lines
      entry.revenue += r.revenue
      entry.revenueWithCost += r.revenueWithCost
      entry.cost += r.cost
      entry.margin += r.margin
      map.set(r.category, entry)
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({
        category,
        label: v.label,
        lines: v.lines,
        revenue: v.revenue,
        cost: v.cost,
        margin: v.margin,
        marginPct:
          v.revenueWithCost > 0 ? round1((v.margin / v.revenueWithCost) * 100) : null,
      }))
      .sort((a, b) => b.margin - a.margin)
  }, [data.categoryMonthly, activeMonthSet])

  // Aggregated Items over active months
  const aggregatedItems = useMemo(() => {
    const map = new Map<
      string,
      {
        itemId: string
        itemName: string
        kind: string
        units: number
        revenue: number
        revenueWithCost: number
        cost: number
        margin: number
        costKnown: boolean
      }
    >()
    for (const r of data.itemMonthly) {
      if (!activeMonthSet.has(r.month)) continue
      const entry = map.get(r.itemId) ?? {
        itemId: r.itemId,
        itemName: r.itemName,
        kind: r.kind,
        units: 0,
        revenue: 0,
        revenueWithCost: 0,
        cost: 0,
        margin: 0,
        costKnown: true,
      }
      entry.units += r.units
      entry.revenue += r.revenue
      entry.revenueWithCost += r.revenueWithCost
      entry.cost += r.cost
      entry.margin += r.margin
      if (!r.costKnown) entry.costKnown = false
      map.set(r.itemId, entry)
    }
    return Array.from(map.values()).map((v) => ({
      ...v,
      marginPct:
        v.revenueWithCost > 0 ? round1((v.margin / v.revenueWithCost) * 100) : null,
    }))
  }, [data.itemMonthly, activeMonthSet])

  const topWinners = useMemo(
    () => [...aggregatedItems].sort((a, b) => b.margin - a.margin).slice(0, 3),
    [aggregatedItems]
  )

  const marginAlerts = useMemo(() => {
    const uncosted = aggregatedItems
      .filter((i) => !i.costKnown)
      .sort((a, b) => b.revenue - a.revenue)
    const lowMargin = aggregatedItems
      .filter((i) => i.costKnown && i.marginPct !== null && i.marginPct < 45 && i.revenue >= 300)
      .sort((a, b) => (a.marginPct ?? 100) - (b.marginPct ?? 100))
    return [...uncosted, ...lowMargin].slice(0, 3)
  }, [aggregatedItems])

  const filteredItems = useMemo(() => {
    const term = itemQuery.trim().toLowerCase()
    return aggregatedItems
      .filter((i) => (kindFilter === "all" ? true : i.kind === kindFilter))
      .filter((i) => (!term ? true : i.itemName.toLowerCase().includes(term)))
      .sort((a, b) => {
        if (itemSort === "units") return b.units - a.units
        if (itemSort === "marginPct") return (b.marginPct ?? -1) - (a.marginPct ?? -1)
        return b.margin - a.margin
      })
  }, [aggregatedItems, kindFilter, itemQuery, itemSort])

  function handleExportCsv() {
    const headers = [
      "Month",
      "Status",
      "Gross Revenue",
      "Returns",
      "Adjustments",
      "Net Revenue",
      "Bank Collected",
      "Fixed Overhead",
      "Variable Costs",
      "Acquisition Spend",
      "Clinic OpEx",
      "Clinic Operating Profit",
      "Owner Draw",
      "CapEx",
      "Retained Cash",
    ]
    const body = filteredMonths.map((m) => [
      m.month,
      m.status,
      m.grossRevenue.toFixed(2),
      m.returned.toFixed(2),
      m.adjustmentRevenue.toFixed(2),
      m.netRevenue.toFixed(2),
      m.collected.toFixed(2),
      m.fixedExpenses.toFixed(2),
      m.variableExpenses.toFixed(2),
      m.acquisitionExpenses.toFixed(2),
      m.clinicOpEx.toFixed(2),
      m.operatingProfit.toFixed(2),
      m.ownerDraw.toFixed(2),
      m.capex.toFixed(2),
      m.retainedCash.toFixed(2),
    ])
    const suffix = `${windowKey}${closedOnly ? "-closed" : "-all"}`
    downloadCsv(`legacymd-board-pnl-${suffix}.csv`, [headers, ...body])
  }

  const ledgerDesc = useMemo(() => [...filteredMonths].reverse(), [filteredMonths])

  return (
    <div className="flex flex-col gap-6">
      {/* Header + Boardroom Control Bar */}
      <PageHeader
        title="Executive reports"
        description="Boardroom P&L, unit economics and acquisition payback across clinic periods."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="closed-only"
                checked={closedOnly}
                onCheckedChange={setClosedOnly}
              />
              <Label htmlFor="closed-only" className="cursor-pointer text-xs text-muted-foreground">
                Closed months only
              </Label>
            </div>

            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[windowKey]}
              onValueChange={(next) => {
                const picked = next[0] as WindowKey | undefined
                if (picked) setWindowKey(picked)
              }}
            >
              <ToggleGroupItem value="3m">3M</ToggleGroupItem>
              <ToggleGroupItem value="6m">6M</ToggleGroupItem>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
            </ToggleGroup>

            <Button size="sm" variant="outline" onClick={handleExportCsv}>
              <Download data-icon="inline-start" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* 30-Second Executive Strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Net revenue"
          value={formatMoneyWhole(summary.netRevenue)}
          action={<Badge variant="secondary">{summary.count} mo</Badge>}
          footer={
            <span className="truncate">
              Collected {formatMoneyWhole(summary.collected)} · {summary.collectionPct}%
            </span>
          }
        />

        <KpiCard
          label="Operating profit"
          value={formatMoneyWhole(summary.operatingProfit)}
          action={
            <Badge
              variant={summary.operatingProfit >= 0 ? "positive" : "destructive"}
              className="gap-1"
            >
              {summary.operatingProfit >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {summary.operatingMarginPct}% op.
            </Badge>
          }
          footer={
            <span className="truncate">
              Before {formatMoneyWhole(summary.ownerDraw)} draw ·{" "}
              {formatMoneyWhole(summary.capex)} CapEx
            </span>
          }
        />

        <KpiCard
          label="Draw coverage"
          value={summary.drawCoverage !== null ? `${summary.drawCoverage}x` : "—"}
          action={
            <Badge variant="gold">
              {formatMoneyWhole(summary.ownerDraw)} drawn
            </Badge>
          }
          footer={
            <span className="truncate">
              Operating profit ÷ physician owner draw
            </span>
          }
        />

        <KpiCard
          label="Retained clinic cash"
          value={formatMoneyWhole(summary.retainedCash)}
          action={
            <Badge variant={summary.retainedCash >= 0 ? "positive" : "destructive"}>
              {summary.retainedCash >= 0 ? "Surplus" : "Deficit"}
            </Badge>
          }
          footer={
            <span className="truncate">
              Avg{" "}
              {formatMoneyWhole(
                summary.count > 0 ? summary.retainedCash / summary.count : 0
              )}
              /mo after draw &amp; CapEx
            </span>
          }
        />
      </div>

      {/* 1-Line Deterministic Executive Brief */}
      {summary.count > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-l-2 border-l-sidebar-primary bg-accent/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">
              {summary.count} {closedOnly ? "closed" : ""} month
              {summary.count === 1 ? "" : "s"} summary:
            </strong>{" "}
            Clinic operating margin averaged{" "}
            <span className="font-mono font-medium text-foreground">
              {summary.operatingMarginPct}%
            </span>
            ; Owner draw absorbed{" "}
            <span className="font-mono font-medium text-foreground">
              {formatMoneyWhole(summary.ownerDraw)}
            </span>{" "}
            and one-time CapEx{" "}
            <span className="font-mono font-medium text-foreground">
              {formatMoneyWhole(summary.capex)}
            </span>
            , leaving{" "}
            <span className="font-mono font-medium text-foreground">
              {formatMoneyWhole(summary.retainedCash)}
            </span>{" "}
            retained.
          </span>
          {marginAlerts.some((a) => !a.costKnown) ? (
            <Link
              href="/catalog/products"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Review uncosted catalog items →
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* 3 Editorial Tabs (variant="line") */}
      <Tabs defaultValue="pnl" className="gap-6">
        <div className="border-b">
          <TabsList variant="line">
            <TabsTrigger value="pnl">Board P&amp;L</TabsTrigger>
            <TabsTrigger value="economics">Unit Economics</TabsTrigger>
            <TabsTrigger value="acquisition">Acquisition &amp; Payback</TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: BOARD P&L */}
        <TabsContent value="pnl" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Operating Profit vs. Owner Draw &amp; Retained Cash</CardTitle>
              <CardDescription>
                Monthly cash distribution across the selected window. Click any row below to
                inspect the full statement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredMonths.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No months match this filter</EmptyTitle>
                    <EmptyDescription>
                      Toggle &quot;Closed months only&quot; off to include open periods.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ChartContainer config={pnlChartConfig} className="h-[260px] w-full">
                  <BarChart data={filteredMonths} accessibilityLayer>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
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
                      dataKey="operatingProfit"
                      fill="var(--color-operatingProfit)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="ownerDraw"
                      fill="var(--color-ownerDraw)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="retainedCash"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    >
                      {filteredMonths.map((entry) => (
                        <Cell
                          key={entry.month}
                          fill={
                            entry.retainedCash >= 0
                              ? "var(--color-retainedCash)"
                              : "var(--chart-5)"
                          }
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
              <CardTitle>Board P&amp;L Ledger</CardTitle>
              <CardDescription>
                Separates clinic operating expenses from owner draw and one-time CapEx. Click
                a month for the full breakdown.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Month</TableHead>
                    <TableHead className="text-right">Net Revenue</TableHead>
                    <TableHead className="text-right">Clinic OpEx</TableHead>
                    <TableHead className="text-right">Operating Profit</TableHead>
                    <TableHead className="text-right">Owner Draw</TableHead>
                    <TableHead className="text-right">CapEx</TableHead>
                    <TableHead className="pr-4 text-right">Retained</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerDesc.map((row) => (
                    <TableRow
                      key={row.month}
                      tabIndex={0}
                      role="button"
                      className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                      onClick={() => setSelectedMonthRow(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelectedMonthRow(row)
                        }
                      }}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2 font-medium">
                          <span>{row.label}</span>
                          {row.status !== "none" ? (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {row.status}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatMoneyWhole(row.netRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {formatMoneyWhole(row.clinicOpEx)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoneyWhole(row.operatingProfit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {row.ownerDraw > 0 ? `−${formatMoneyWhole(row.ownerDraw)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {row.capex > 0 ? `−${formatMoneyWhole(row.capex)}` : "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Badge
                          variant={row.retainedCash >= 0 ? "positive" : "destructive"}
                          className="font-mono"
                        >
                          {formatMoneyWhole(row.retainedCash)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {summary.count > 0 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="pl-4 font-semibold">
                        Period Total ({summary.count} mo)
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoneyWhole(summary.netRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatMoneyWhole(summary.clinicOpEx)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoneyWhole(summary.operatingProfit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        −{formatMoneyWhole(summary.ownerDraw)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {summary.capex > 0 ? `−${formatMoneyWhole(summary.capex)}` : "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoneyWhole(summary.retainedCash)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: UNIT ECONOMICS */}
        <TabsContent value="economics" className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Category Margin Contribution</CardTitle>
                <CardDescription>
                  Aggregated net margin ($) across the selected period by clinical vertical.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {aggregatedCategories.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No category data</EmptyTitle>
                      <EmptyDescription>
                        No sales lines found in the selected period.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer
                    config={categoryChartConfig}
                    className="h-[220px] w-full"
                  >
                    <BarChart
                      data={aggregatedCategories}
                      layout="vertical"
                      margin={{ left: 16, right: 16 }}
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
                        width={112}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            valueFormatter={(value) => formatMoneyWhole(value)}
                          />
                        }
                      />
                      <Bar dataKey="margin" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                        {aggregatedCategories.map((entry, idx) => (
                          <Cell
                            key={entry.category}
                            fill={idx === 0 ? "var(--chart-1)" : "var(--chart-2)"}
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
                <CardTitle>Winners vs. Margin Guard</CardTitle>
                <CardDescription>
                  Top profit generators and items requiring cost or pricing attention.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Top Profit Drivers
                  </span>
                  {topWinners.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate font-medium">{item.itemName}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono font-semibold tabular-nums">
                          {formatMoneyWhole(item.margin)}
                        </span>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {formatPercent(item.marginPct)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Margin Alerts / Uncosted
                  </span>
                  {marginAlerts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      All active items have confirmed costs and healthy margins (≥ 45%).
                    </p>
                  ) : (
                    marginAlerts.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                          <span className="truncate">{item.itemName}</span>
                        </span>
                        <Badge variant="destructive" className="font-mono text-[10px]">
                          {!item.costKnown
                            ? `${formatMoneyWhole(item.revenue)} uncosted`
                            : formatPercent(item.marginPct)}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Item Profitability Explorer</CardTitle>
              <CardDescription>
                Filter by catalog kind or search any treatment, package or product.
              </CardDescription>
              <CardAction>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      placeholder="Filter item..."
                      className="h-8 w-44 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={kindFilter}
                    onValueChange={(v) => v && setKindFilter(v)}
                  >
                    <SelectTrigger size="sm" className="w-[125px]">
                      <SelectValue placeholder="All kinds">
                        {(value: string) => {
                          if (value === "treatment") return "Treatments"
                          if (value === "product") return "Products"
                          if (value === "service") return "Services"
                          return "All kinds"
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All kinds</SelectItem>
                      <SelectItem value="treatment">Treatments</SelectItem>
                      <SelectItem value="product">Products</SelectItem>
                      <SelectItem value="service">Services</SelectItem>
                    </SelectContent>
                  </Select>
                  <ToggleGroup
                    variant="outline"
                    size="sm"
                    spacing={0}
                    value={[itemSort]}
                    onValueChange={(next) => {
                      const picked = next[0] as ItemSortKey | undefined
                      if (picked) setItemSort(picked)
                    }}
                  >
                    <ToggleGroupItem value="margin">Margin $</ToggleGroupItem>
                    <ToggleGroupItem value="marginPct">Margin %</ToggleGroupItem>
                    <ToggleGroupItem value="units">Units</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No matching items</EmptyTitle>
                      <EmptyDescription>
                        Try clearing your search or switching catalog kind.
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
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Margin $</TableHead>
                      <TableHead className="w-40 pr-4 text-right">Margin %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.slice(0, 25).map((row) => (
                      <TableRow key={row.itemId}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>{row.itemName}</span>
                            {!row.costKnown ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span tabIndex={0} className="inline-flex cursor-help" />
                                  }
                                >
                                  <AlertCircle className="size-3.5 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Missing confirmed cost on one or more lines in this
                                  period.
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
                        <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {formatMoneyWhole(row.cost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                          {formatMoneyWhole(row.margin)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Progress
                              value={Math.max(0, Math.min(100, row.marginPct ?? 0))}
                              className="w-16"
                            />
                            <span className="w-12 text-right font-mono text-xs tabular-nums">
                              {formatPercent(row.marginPct)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ACQUISITION & PAYBACK */}
        <TabsContent value="acquisition" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Acquisition Spend vs. First-Visit Revenue</CardTitle>
              <CardDescription>
                Monthly advertising + consulting spend against immediate first-visit revenue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredMonths.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No months match this filter</EmptyTitle>
                    <EmptyDescription>
                      Toggle &quot;Closed months only&quot; off to include open periods.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ChartContainer config={acqChartConfig} className="h-[240px] w-full">
                  <BarChart data={filteredMonths} accessibilityLayer>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
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
                      dataKey="firstVisitRevenue"
                      fill="var(--color-firstVisitRevenue)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="acquisitionExpenses"
                      fill="var(--color-acquisitionExpenses)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Monthly CAC &amp; Day-1 Payback</CardTitle>
                <CardDescription>
                  Non-voided acquisition spend paired with new patients acquired.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Month</TableHead>
                      <TableHead className="text-right">Acq. Spend</TableHead>
                      <TableHead className="text-right">New</TableHead>
                      <TableHead className="text-right">Ad CAC</TableHead>
                      <TableHead className="text-right">Blended CAC</TableHead>
                      <TableHead className="pr-4 text-right">1st-Visit ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerDesc.map((row) => {
                      const adCac =
                        row.newPatients > 0 && row.adSpend > 0
                          ? row.adSpend / row.newPatients
                          : null
                      const blendedCac =
                        row.newPatients > 0 && row.acquisitionExpenses > 0
                          ? row.acquisitionExpenses / row.newPatients
                          : null
                      const roas =
                        row.acquisitionExpenses > 0
                          ? round1(row.firstVisitRevenue / row.acquisitionExpenses)
                          : null
                      return (
                        <TableRow key={row.month}>
                          <TableCell className="pl-4 font-medium">
                            {row.shortLabel} {row.month.slice(0, 4)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMoneyWhole(row.acquisitionExpenses)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {row.newPatients}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {adCac !== null ? formatMoneyWhole(adCac) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {blendedCac !== null ? formatMoneyWhole(blendedCac) : "—"}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            {roas !== null ? (
                              <Badge
                                variant={roas >= 3 ? "gold" : "outline"}
                                className="font-mono"
                              >
                                {roas}x
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  {summary.count > 0 ? (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="pl-4 font-semibold">Weighted Total</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                          {formatMoneyWhole(summary.acqTotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                          {summary.newPatients}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {summary.adCac !== null ? formatMoneyWhole(summary.adCac) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                          {summary.blendedCac !== null
                            ? formatMoneyWhole(summary.blendedCac)
                            : "—"}
                        </TableCell>
                        <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums">
                          {summary.blendedRoas !== null ? `${summary.blendedRoas}x` : "—"}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Channel Cohort LTV</CardTitle>
                <CardDescription>
                  Lifetime cash spent and repeat rate by acquisition source.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {data.channelCohorts.length === 0 ? (
                  <div className="px-4 py-6">
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No channel cohorts yet</EmptyTitle>
                        <EmptyDescription>
                          First-visit acquisition sources will populate here once sales are
                          logged.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Source</TableHead>
                        <TableHead className="text-right">New</TableHead>
                        <TableHead className="text-right">Repeat %</TableHead>
                        <TableHead className="pr-4 text-right">Realized LTV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.channelCohorts.map((ch) => (
                        <TableRow key={ch.channel}>
                          <TableCell className="pl-4 font-medium">{ch.channel}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {ch.newPatients}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            <Badge
                              variant={ch.repeatRatePct < 25 ? "destructive" : "secondary"}
                              className="font-mono"
                            >
                              {ch.repeatRatePct}%
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-4 text-right font-mono text-xs font-medium tabular-nums">
                            {formatMoneyWhole(ch.realizedLtv)}
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
      </Tabs>

      {/* Month P&L Drill-Down Sheet */}
      <Sheet
        open={selectedMonthRow !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMonthRow(null)
        }}
      >
        <SheetContent className="sm:max-w-md">
          {selectedMonthRow ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMonthRow.label}</SheetTitle>
                <SheetDescription>
                  Board P&amp;L statement grouped by cost behavior (
                  {selectedMonthRow.status === "closed" ? "Closed month" : "Open month"}).
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-3 px-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Revenue</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(selectedMonthRow.grossRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: Returns</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    −{formatMoney(selectedMonthRow.returned)}
                  </span>
                </div>
                {selectedMonthRow.adjustmentRevenue !== 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue Adjustments</span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {selectedMonthRow.adjustmentRevenue >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(selectedMonthRow.adjustmentRevenue))}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between font-medium">
                  <span>Net Revenue</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(selectedMonthRow.netRevenue)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fixed Clinic Overhead</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    −{formatMoney(selectedMonthRow.fixedExpenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variable Supplies &amp; Fees</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    −{formatMoney(selectedMonthRow.variableExpenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient Acquisition</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    −{formatMoney(selectedMonthRow.acquisitionExpenses)}
                  </span>
                </div>
                <div className="flex justify-between rounded-md bg-muted/40 px-2.5 py-2 font-semibold">
                  <span>Clinic Operating Profit</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(selectedMonthRow.operatingProfit)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: Owner Draw</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    −{formatMoney(selectedMonthRow.ownerDraw)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: One-Time CapEx</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    −{formatMoney(selectedMonthRow.capex)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Retained Clinic Cash</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(selectedMonthRow.retainedCash)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Bank Cash Collected</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(selectedMonthRow.collected)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Unit-Economics Gross Margin</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(selectedMonthRow.grossMargin)} (
                    {formatPercent(selectedMonthRow.grossMarginPct)})
                  </span>
                </div>

                <div className="pt-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link href={`/?view=monthly&month=${selectedMonthRow.month}`} />
                    }
                  >
                    Open month in Dashboard
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
