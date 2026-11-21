"use client"

import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  CreditCard,
  DollarSign,
  Phone,
  Receipt,
  Users,
  Wallet,
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DailyDashboardData } from "@/lib/dashboard"
import { formatMoney, formatMoneyWhole } from "@/lib/format"

function digitsOnly(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return null
  return digits.length === 10 ? `1${digits}` : digits
}

export function DailyView({ data }: { data: DailyDashboardData }) {
  const totalMethods = data.paymentMethods.reduce((s, m) => s + m.amount, 0)
  const instantTotal = data.paymentMethods
    .filter((m) => m.riskLane === "instant")
    .reduce((s, m) => s + m.amount, 0)
  const installmentTotal = data.paymentMethods
    .filter((m) => m.riskLane === "installment")
    .reduce((s, m) => s + m.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      {data.overdueCount > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Overdue installments need collection</AlertTitle>
          <AlertDescription>
            <Link href="/open-items" className="underline underline-offset-4">
              {data.overdueCount} overdue installment{data.overdueCount === 1 ? "" : "s"} (
              {formatMoneyWhole(data.overdueTotal)} past due)
            </Link>{" "}
            — review and collect in Open items.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Row 1: 4 Daily Numbers KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sold today"
          value={formatMoneyWhole(data.soldToday)}
          action={
            <Badge variant="secondary">
              {data.salesCount} sale{data.salesCount === 1 ? "" : "s"}
            </Badge>
          }
          footer={
            <>
              <DollarSign className="size-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">
                {data.newPatientsToday} new · {data.repeatPatientsToday} repeat
              </span>
            </>
          }
        />

        <KpiCard
          label="Collected today"
          value={formatMoneyWhole(data.collectedToday)}
          action={
            <Tooltip>
              <TooltipTrigger
                render={<span tabIndex={0} className="inline-flex cursor-help" />}
              >
                <Badge variant="outline">
                  {data.receiptsCountToday} receipt
                  {data.receiptsCountToday === 1 ? "" : "s"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Actual bank &amp; cash receipts recorded today (independent of sales
                accrual).
              </TooltipContent>
            </Tooltip>
          }
          footer={
            <>
              <CreditCard className="size-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">Bank cash lane · settled today</span>
            </>
          }
        />

        <KpiCard
          label="Average ticket"
          value={data.salesCount > 0 ? formatMoney(data.avgTicketToday) : "—"}
          action={
            <Badge variant="outline">
              {data.patientsSeenToday} patient{data.patientsSeenToday === 1 ? "" : "s"}
            </Badge>
          }
          footer={
            <>
              <Users className="size-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">Per non-voided sale today</span>
            </>
          }
        />

        <KpiCard
          label="Overdue balance"
          value={formatMoneyWhole(data.overdueTotal)}
          action={
            <Badge variant={data.overdueCount > 0 ? "destructive" : "secondary"}>
              {data.overdueCount} overdue
            </Badge>
          }
          footer={
            <>
              <Clock className="size-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">
                {data.dueTodayCount > 0
                  ? `+ ${formatMoneyWhole(data.dueTodayTotal)} due today`
                  : "No installments due today"}
              </span>
            </>
          }
        />
      </div>

      {/* Row 2: Today's Sales + Cash Drawer */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Today&apos;s Sales</CardTitle>
            <CardDescription>
              Completed clinic visits and treatments logged on this business day.
            </CardDescription>
            <CardAction>
              <Button
                size="xs"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/sales/details?date=${data.date}`} />}
              >
                View details
                <ArrowRight className="size-3" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 px-0">
            {data.salesToday.length === 0 ? (
              <div className="px-4 py-6">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Receipt className="size-4" />
                    </EmptyMedia>
                    <EmptyTitle>No sales logged for this day</EmptyTitle>
                    <EmptyDescription>
                      Use New sale to record a patient visit and payment plan.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Patient</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead className="pr-4 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.salesToday.map((row) => (
                    <TableRow key={row.saleId}>
                      <TableCell className="pl-4">
                        <Link
                          href={`/patients/${row.patientId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.patientName}
                        </Link>
                        {row.source ? (
                          <div className="text-xs text-muted-foreground">{row.source}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.itemsSummary}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isFirstVisit ? "secondary" : "outline"}>
                          {row.isFirstVisit ? "New" : "Repeat"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-xs font-medium tabular-nums">
                        {formatMoney(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Cash Drawer by Method</CardTitle>
            <CardDescription>
              Receipts collected today grouped by payment method.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-6">
            {data.paymentMethods.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Wallet className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No receipts yet</EmptyTitle>
                  <EmptyDescription>
                    Receipts appear here as payments are recorded.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-4">
                {data.paymentMethods.map((item) => {
                  const pct =
                    totalMethods > 0 ? Math.round((item.amount / totalMethods) * 100) : 0
                  return (
                    <Progress key={item.slug} value={pct} className="gap-1.5">
                      <ProgressLabel className="flex items-center gap-2 text-xs">
                        <span>{item.label}</span>
                        <Badge
                          variant={
                            item.riskLane === "installment" ? "outline" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {item.count} {item.count === 1 ? "tx" : "txs"}
                        </Badge>
                      </ProgressLabel>
                      <ProgressValue className="font-mono text-xs">
                        {() => `${formatMoney(item.amount)} (${pct}%)`}
                      </ProgressValue>
                    </Progress>
                  )
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
              <div>
                <div className="text-muted-foreground">Instant settled</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatMoney(instantTotal)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Credit, Cherry, Zelle, Cash
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Installment lane</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatMoney(installmentTotal)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Stripe recurring receipts
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="mt-auto justify-between text-sm">
            <span className="text-muted-foreground">Total collected</span>
            <span className="font-mono font-semibold tabular-nums">
              {formatMoney(totalMethods)}
            </span>
          </CardFooter>
        </Card>
      </div>

      {/* Row 3: Due & Overdue Collections */}
      <Card>
        <CardHeader>
          <CardTitle>Due &amp; Overdue Installments</CardTitle>
          <CardDescription>
            Pending scheduled payments up to this day ready for collection.
          </CardDescription>
          <CardAction>
            <Button
              size="xs"
              variant="outline"
              nativeButton={false}
              render={<Link href="/open-items" />}
            >
              Open items
              <ArrowRight className="size-3" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {data.dueInstallments.length === 0 ? (
            <div className="px-4 py-4">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Wallet className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No due or overdue installments</EmptyTitle>
                  <EmptyDescription>
                    All scheduled installments up to this day are settled.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Patient</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dueInstallments.map((item) => {
                  const wa = digitsOnly(item.phone)
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="pl-4">
                        <Link
                          href={`/patients/${item.patientId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {item.patientName}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.phone ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{item.method}</TableCell>
                      <TableCell className="font-mono text-xs">{item.dueOn}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.daysOverdue > 0 ? "destructive" : "outline"}
                        >
                          {item.daysOverdue > 0
                            ? `${item.daysOverdue}d overdue`
                            : "Due today"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium tabular-nums">
                        {formatMoney(item.remaining)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {wa ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              nativeButton={false}
                              render={<a href={`tel:+${wa}`} />}
                            >
                              <Phone className="size-3" />
                              Call
                            </Button>
                          ) : null}
                          <Button
                            size="xs"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href="/open-items" />}
                          >
                            Collect
                          </Button>
                        </div>
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
  )
}
