"use client"

import { useMemo, useState } from "react"
import { Wallet } from "lucide-react"

import { ExpenseEntryDialog } from "@/components/expense-entry-dialog"
import { ExpenseVoidDialog } from "@/components/expense-void-dialog"
import { Badge } from "@/components/ui/badge"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  ExpenseCategoryOption,
  ExpenseCostBehavior,
  ExpenseItemOption,
  ExpenseLine,
  SupplierOption,
} from "@/lib/expenses"
import { formatMoney, formatMoneyWhole } from "@/lib/format"

type BehaviorFilter = "all" | ExpenseCostBehavior

const behaviorMeta: Record<
  ExpenseCostBehavior,
  { label: string; variant: "secondary" | "outline" | "gold" | "positive" }
> = {
  fixed: { label: "Fixed", variant: "secondary" },
  variable: { label: "Variable", variant: "outline" },
  acquisition: { label: "Acquisition", variant: "positive" },
  owner_draw: { label: "Owner draw", variant: "gold" },
  capex: { label: "CapEx", variant: "outline" },
}

const filterOrder: BehaviorFilter[] = [
  "all",
  "fixed",
  "variable",
  "acquisition",
  "owner_draw",
  "capex",
]

export function ExpenseMonthLines({
  periodId,
  period,
  open,
  lines,
  items,
  suppliers,
  categories,
}: {
  periodId: string
  period: string
  open: boolean
  lines: ExpenseLine[]
  items: ExpenseItemOption[]
  suppliers: SupplierOption[]
  categories: ExpenseCategoryOption[]
}) {
  const [filter, setFilter] = useState<BehaviorFilter>("all")

  const totals = useMemo(() => {
    const map: Record<BehaviorFilter, number> = {
      all: 0,
      fixed: 0,
      variable: 0,
      acquisition: 0,
      owner_draw: 0,
      capex: 0,
    }
    for (const line of lines) {
      if (line.voided) continue
      map.all += line.amount
      map[line.costBehavior] += line.amount
    }
    return map
  }, [lines])

  const visibleLines = useMemo(() => {
    if (filter === "all") return lines
    return lines.filter((line) => line.costBehavior === filter)
  }, [lines, filter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[filter]}
          onValueChange={(next) => {
            const picked = next[0] as BehaviorFilter | undefined
            if (picked) setFilter(picked)
          }}
        >
          {filterOrder.map((key) => {
            const label = key === "all" ? "All" : behaviorMeta[key].label
            const amount = totals[key]
            if (key !== "all" && amount === 0) return null
            return (
              <ToggleGroupItem key={key} value={key} className="gap-1.5">
                <span>{label}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {formatMoneyWhole(amount)}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <span className="text-xs text-muted-foreground tabular-nums">
          Showing {visibleLines.length} of {lines.length} line
          {lines.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">Expense</TableHead>
              <TableHead className="w-28">Type</TableHead>
              <TableHead className="w-36">Category</TableHead>
              <TableHead className="w-36">Supplier</TableHead>
              <TableHead className="w-28 text-right">Amount</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLines.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Wallet />
                      </EmptyMedia>
                      <EmptyTitle>
                        {lines.length === 0
                          ? "No expenses in this month"
                          : "No expenses in this filter"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {lines.length === 0
                          ? open
                            ? "Add the rent, the payroll, the labs."
                            : "The month closed with no lines."
                          : "Switch back to All to see every expense line."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              visibleLines.map((line) => {
                const meta = behaviorMeta[line.costBehavior]
                return (
                  <TableRow
                    key={line.id}
                    className={line.voided ? "opacity-60" : undefined}
                  >
                    <TableCell className="truncate font-medium" title={line.itemName}>
                      {line.voided ? (
                        <span className="line-through">{line.itemName}</span>
                      ) : (
                        line.itemName
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {line.categoryLabel}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {line.supplierName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatMoney(line.amount)}
                    </TableCell>
                    <TableCell
                      className="truncate text-muted-foreground"
                      title={line.voidReason ?? line.note ?? undefined}
                    >
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
                              periodId={periodId}
                              period={period}
                              items={items}
                              suppliers={suppliers}
                              categories={categories}
                              lines={lines}
                              entry={line}
                            />
                            <ExpenseVoidDialog
                              id={line.id}
                              period={period}
                              itemName={line.itemName}
                            />
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
