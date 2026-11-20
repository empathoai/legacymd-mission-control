import Link from "next/link"
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react"

import { DateFilter } from "@/components/date-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listCustomersPaged } from "@/lib/customers"
import { clinicToday, formatClinicDay } from "@/lib/dates"
import { listCustomersInPeriod } from "@/lib/customers"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

type ReportRow = {
  id: string
  fullName: string
  phone: string | null
  spent: number
  returns: number
  balance: number
  visits: number
  lastVisitOn: string | null
  nextDueOn: string | null
  isOverdue: boolean
  isSettled: boolean
}

type ReportPage = {
  rows: ReportRow[]
  total: number
  page: number
  pageCount: number
}

function formatDay(value: string | null) {
  return value ? formatClinicDay(value) : "—"
}

function status(row: { isOverdue: boolean; balance: number; visits: number }) {
  if (row.isOverdue) return <Badge variant="destructive">Overdue</Badge>
  if (row.balance > 0) return <Badge>Open</Badge>
  if (row.visits === 0) return <Badge variant="secondary">No visits</Badge>
  return <Badge variant="secondary">Settled</Badge>
}

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[]
    date?: string | string[]
    from?: string | string[]
    to?: string | string[]
    page?: string | string[]
  }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : undefined
  const rawPage = typeof params.page === "string" ? Number(params.page) : 1
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1
  const today = clinicToday()

  const hasDate =
    validDay(params.date) || validDay(params.from) || validDay(params.to)
  const rangeMode = validDay(params.from) || validDay(params.to)
  const mode: "all" | "day" | "range" = !hasDate
    ? "all"
    : rangeMode
      ? "range"
      : "day"

  const date = validDay(params.date) ? params.date : today
  const from = validDay(params.from) ? params.from : date
  const to = validDay(params.to) ? params.to : from

  const paged: ReportPage =
    mode === "all"
      ? await listCustomersPaged({ query: q, page, pageSize: PAGE_SIZE }).then(
          (result) => ({
            rows: result.rows.map((row) => ({
              id: row.id,
              fullName: row.fullName,
              phone: row.phone,
              spent: row.spentTotal,
              returns: row.refundedTotal,
              balance: row.balance,
              visits: row.visits,
              lastVisitOn: row.lastVisitOn,
              nextDueOn: row.nextDueOn,
              isOverdue: row.isOverdue,
              isSettled: row.isSettled,
            })),
            total: result.total,
            page: result.page,
            pageCount: result.pageCount,
          })
        )
      : await listCustomersInPeriod({
          from: mode === "range" ? from : date,
          to: mode === "range" ? to : date,
          query: q,
          page,
          pageSize: PAGE_SIZE,
        })

  const rows = paged.rows
  const first = paged.total === 0 ? 0 : (paged.page - 1) * PAGE_SIZE + 1
  const last = Math.min(paged.page * PAGE_SIZE, paged.total)

  const periodLabel =
    mode === "all"
      ? "All time"
      : mode === "range" && from !== to
        ? `${formatClinicDay(from)} – ${formatClinicDay(to)}`
        : formatClinicDay(mode === "range" ? from : date)
  const isToday =
    mode === "day"
      ? date === today
      : mode === "range"
        ? from === today && to === today
        : false

  const modeQuery =
    mode === "range" ? `from=${from}&to=${to}` : mode === "day" ? `date=${date}` : ""
  const todayQuery =
    mode === "range" ? `from=${today}&to=${today}` : `date=${today}`
  const searchSuffix = q ? `&q=${encodeURIComponent(q)}` : ""

  function pageHref(target: number) {
    const sp = new URLSearchParams()
    if (mode === "range") {
      sp.set("from", from)
      sp.set("to", to)
    } else if (mode === "day") {
      sp.set("date", date)
    }
    if (q) sp.set("q", q)
    sp.set("page", String(target))
    return `/patients/report?${sp.toString()}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Patient report</h2>
        <p className="text-sm text-muted-foreground">
          Search a patient to see when they last came, what they spent and what they
          still owe.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <DateFilter
            mode={mode}
            date={date}
            from={from}
            to={to}
            basePath="/patients/report"
            showAll
          />
          {mode !== "all" && !isToday ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={`/patients/report?${todayQuery}${searchSuffix}`} />}
            >
              Today
            </Button>
          ) : null}
        </div>
        <Badge variant="secondary">{periodLabel}</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex w-full max-w-md items-center gap-2"
          action="/patients/report"
        >
          {mode === "range" ? (
            <>
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
            </>
          ) : mode === "day" ? (
            <input type="hidden" name="date" value={date} />
          ) : null}
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name"
            className="flex-1"
          />
          <Button type="submit" variant="outline">
            <Search data-icon="inline-start" />
            Search
          </Button>
          {q ? (
            <Button
              variant="ghost"
              nativeButton={false}
              render={
                <Link
                  href={`/patients/report${modeQuery ? `?${modeQuery}` : ""}`}
                />
              }
            >
              Clear
            </Button>
          ) : null}
        </form>
        <Badge variant="secondary">{paged.total} patients</Badge>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Returns</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead>Last visit</TableHead>
              <TableHead>Next due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="p-0">
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Users />
                      </EmptyMedia>
                      <EmptyTitle>
                        {mode === "all"
                          ? "No patient matches"
                          : `No patients bought in ${periodLabel}`}
                      </EmptyTitle>
                      <EmptyDescription>
                        {mode === "all"
                          ? "Try another spelling, or clear the search."
                          : "Pick another period, or clear the search."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/patients/${row.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money.format(row.spent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money.format(row.returns)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(row.balance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.visits}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDay(row.lastVisitOn)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDay(row.nextDueOn)}
                  </TableCell>
                  <TableCell>{status(row)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {paged.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={paged.page <= 1}
            nativeButton={false}
            render={<Link href={pageHref(paged.page - 1)} />}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {first}–{last} of {paged.total} · page {paged.page} of {paged.pageCount}
          </span>
          <Button
            variant="outline"
            disabled={paged.page >= paged.pageCount}
            nativeButton={false}
            render={<Link href={pageHref(paged.page + 1)} />}
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
