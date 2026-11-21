"use client"

import Link from "next/link"
import { Fragment, useMemo, useState } from "react"
import { Search, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
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
import type {
  ExpenseCostBehavior,
  ExpenseMatrixRow,
  ExpenseMonth,
} from "@/lib/expenses"
import { formatMoneyWhole } from "@/lib/format"

type BehaviorFilter = "all" | ExpenseCostBehavior

const behaviorOrder: ExpenseCostBehavior[] = [
  "fixed",
  "variable",
  "acquisition",
  "owner_draw",
  "capex",
]

const behaviorLabel: Record<ExpenseCostBehavior, string> = {
  fixed: "Fixed Overhead",
  variable: "Variable Costs",
  acquisition: "Acquisition",
  owner_draw: "Owner Draw",
  capex: "CapEx",
}

const shortBehaviorLabel: Record<ExpenseCostBehavior, string> = {
  fixed: "Fixed",
  variable: "Variable",
  acquisition: "Acquisition",
  owner_draw: "Owner draw",
  capex: "CapEx",
}

function shortMonthLabel(period: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${period}T12:00:00`))
}

function compactMonthLabel(period: string, multiYear: boolean) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    ...(multiYear ? { year: "2-digit" } : {}),
  }).format(new Date(`${period}T12:00:00`))
}

export function ExpensesLedgerTabs({
  months,
  matrixRows,
  selectedYear,
}: {
  months: ExpenseMonth[]
  matrixRows: ExpenseMatrixRow[]
  selectedYear?: string
}) {
  const [behaviorFilter, setBehaviorFilter] = useState<BehaviorFilter>("all")
  const [query, setQuery] = useState("")

  // Chronological columns for the matrix (left to right)
  const chronoMonths = useMemo(() => [...months].reverse(), [months])
  const multiYear = useMemo(
    () => new Set(months.map((m) => m.period.slice(0, 4))).size > 1,
    [months]
  )

  const summaryTotals = useMemo(
    () =>
      months.reduce(
        (acc, m) => ({
          netRevenue: acc.netRevenue + m.netRevenue,
          fixed: acc.fixed + m.fixed,
          variable: acc.variable + m.variable,
          acquisition: acc.acquisition + m.acquisition,
          clinicOpEx: acc.clinicOpEx + m.clinicOpEx,
          operatingProfit: acc.operatingProfit + m.operatingProfit,
          ownerDraw: acc.ownerDraw + m.ownerDraw,
          capex: acc.capex + m.capex,
          result: acc.result + m.result,
        }),
        {
          netRevenue: 0,
          fixed: 0,
          variable: 0,
          acquisition: 0,
          clinicOpEx: 0,
          operatingProfit: 0,
          ownerDraw: 0,
          capex: 0,
          result: 0,
        }
      ),
    [months]
  )

  const filteredMatrix = useMemo(() => {
    const term = query.trim().toLowerCase()
    return matrixRows
      .filter((r) => (behaviorFilter === "all" ? true : r.costBehavior === behaviorFilter))
      .filter((r) =>
        !term
          ? true
          : r.itemName.toLowerCase().includes(term) ||
            r.categoryLabel.toLowerCase().includes(term)
      )
  }, [matrixRows, behaviorFilter, query])

  const groupedMatrix = useMemo(() => {
    return behaviorOrder
      .map((behavior) => {
        const rows = filteredMatrix.filter((r) => r.costBehavior === behavior)
        if (rows.length === 0) return null
        const byPeriod: Record<string, number> = {}
        let total = 0
        for (const row of rows) {
          total += row.total
          for (const [p, amt] of Object.entries(row.byPeriod)) {
            byPeriod[p] = (byPeriod[p] ?? 0) + amt
          }
        }
        return { behavior, rows, byPeriod, total }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }, [filteredMatrix])

  const matrixColumnTotals = useMemo(() => {
    const byPeriod: Record<string, number> = {}
    let total = 0
    for (const row of filteredMatrix) {
      total += row.total
      for (const [p, amt] of Object.entries(row.byPeriod)) {
        byPeriod[p] = (byPeriod[p] ?? 0) + amt
      }
    }
    return { byPeriod, total }
  }, [filteredMatrix])

  const monthCount = chronoMonths.length || 1

  return (
    <Tabs defaultValue="summary" className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b">
        <TabsList variant="line">
          <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
          <TabsTrigger value="matrix">Expense Matrix (By Item)</TabsTrigger>
        </TabsList>
        <span className="pb-1.5 text-xs text-muted-foreground">
          {months.length} month{months.length === 1 ? "" : "s"} · Click any month to
          inspect or edit lines
        </span>
      </div>

      {/* TAB 1: MONTHLY SUMMARY */}
      <TabsContent value="summary">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Net Rev</TableHead>
                <TableHead className="text-right">Fixed</TableHead>
                <TableHead className="text-right">Variable</TableHead>
                <TableHead className="text-right">Acquisition</TableHead>
                <TableHead className="text-right">Clinic OpEx</TableHead>
                <TableHead className="text-right">Op. Profit</TableHead>
                <TableHead className="text-right">Owner Draw</TableHead>
                <TableHead className="text-right">CapEx</TableHead>
                <TableHead className="text-right">Retained</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={10} className="p-0">
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
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/expenses/${month.period}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {shortMonthLabel(month.period)}
                        </Link>
                        {month.status === "closed" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Closed
                          </Badge>
                        ) : (
                          <Badge variant="gold" className="text-[10px]">
                            Open
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatMoneyWhole(month.netRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {month.fixed > 0 ? formatMoneyWhole(month.fixed) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {month.variable > 0 ? formatMoneyWhole(month.variable) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {month.acquisition > 0 ? formatMoneyWhole(month.acquisition) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {formatMoneyWhole(month.clinicOpEx)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                      {formatMoneyWhole(month.operatingProfit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {month.ownerDraw > 0 ? `−${formatMoneyWhole(month.ownerDraw)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {month.capex > 0 ? `−${formatMoneyWhole(month.capex)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={month.result >= 0 ? "positive" : "destructive"}
                        className="font-mono"
                      >
                        {formatMoneyWhole(month.result)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {months.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">
                    {selectedYear
                      ? `Total ${selectedYear} (${months.length} mo)`
                      : `Total (${months.length} mo)`}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoneyWhole(summaryTotals.netRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatMoneyWhole(summaryTotals.fixed)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatMoneyWhole(summaryTotals.variable)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatMoneyWhole(summaryTotals.acquisition)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoneyWhole(summaryTotals.clinicOpEx)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoneyWhole(summaryTotals.operatingProfit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    −{formatMoneyWhole(summaryTotals.ownerDraw)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {summaryTotals.capex > 0 ? `−${formatMoneyWhole(summaryTotals.capex)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoneyWhole(summaryTotals.result)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </TabsContent>

      {/* TAB 2: DYNAMIC EXPENSE MATRIX (ITEM × MONTH) */}
      <TabsContent value="matrix" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[behaviorFilter]}
            onValueChange={(next) => {
              const picked = next[0] as BehaviorFilter | undefined
              if (picked) setBehaviorFilter(picked)
            }}
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {behaviorOrder.map((b) => (
              <ToggleGroupItem key={b} value={b}>
                {shortBehaviorLabel[b]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter expense item..."
              className="h-8 w-52 bg-card pl-8 text-xs"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-[200px] bg-muted/80 backdrop-blur-xs">
                  Expense Item
                </TableHead>
                {chronoMonths.map((m) => (
                  <TableHead key={m.period} className="text-right">
                    <Link
                      href={`/expenses/${m.period}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {compactMonthLabel(m.period, multiYear)}
                    </Link>
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Avg/mo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedMatrix.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={chronoMonths.length + 3} className="p-0">
                    <Empty className="rounded-none border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Wallet />
                        </EmptyMedia>
                        <EmptyTitle>No expense items match</EmptyTitle>
                        <EmptyDescription>
                          Try clearing your search or switching the cost-type filter.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                groupedMatrix.map((group) => (
                  <Fragment key={group.behavior}>
                    <TableRow className="bg-muted/35 hover:bg-muted/35">
                      <TableCell className="sticky left-0 z-10 bg-muted/60 py-1.5 text-xs font-semibold tracking-wide uppercase backdrop-blur-xs">
                        {behaviorLabel[group.behavior]}
                      </TableCell>
                      {chronoMonths.map((m) => (
                        <TableCell
                          key={m.period}
                          className="py-1.5 text-right font-mono text-xs font-medium text-muted-foreground tabular-nums"
                        >
                          {group.byPeriod[m.period]
                            ? formatMoneyWhole(group.byPeriod[m.period])
                            : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="py-1.5 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoneyWhole(group.total)}
                      </TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {formatMoneyWhole(group.total / monthCount)}
                      </TableCell>
                    </TableRow>

                    {group.rows.map((row) => (
                      <TableRow key={row.itemId}>
                        <TableCell className="sticky left-0 z-10 bg-card">
                          <div className="font-medium">{row.itemName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.categoryLabel}
                          </div>
                        </TableCell>
                        {chronoMonths.map((m) => {
                          const val = row.byPeriod[m.period]
                          return (
                            <TableCell
                              key={m.period}
                              className="text-right font-mono text-xs text-muted-foreground tabular-nums"
                            >
                              {val ? formatMoneyWhole(val) : "—"}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                          {formatMoneyWhole(row.total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {formatMoneyWhole(row.total / monthCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
            {groupedMatrix.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-muted/80 font-semibold backdrop-blur-xs">
                    Total ({filteredMatrix.length} items)
                  </TableCell>
                  {chronoMonths.map((m) => (
                    <TableCell
                      key={m.period}
                      className="text-right font-mono text-xs font-semibold tabular-nums"
                    >
                      {matrixColumnTotals.byPeriod[m.period]
                        ? formatMoneyWhole(matrixColumnTotals.byPeriod[m.period])
                        : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoneyWhole(matrixColumnTotals.total)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoneyWhole(matrixColumnTotals.total / monthCount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  )
}
