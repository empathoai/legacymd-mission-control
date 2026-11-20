import Link from "next/link"
import { Fragment } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { AppointmentRowActions } from "@/components/appointment-row-actions"
import { PatientSearch } from "@/components/patient-search"
import { DateFilter } from "@/components/date-filter"
import { NewAppointmentDialog } from "@/components/new-appointment-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  APPOINTMENTS_PER_PAGE,
  listAgenda,
  listAppointmentOptions,
  listHistory,
  type AgendaRow,
  type AppointmentStatus,
} from "@/lib/appointments"
import { clinicToday, formatClinicDay } from "@/lib/dates"

export const dynamic = "force-dynamic"

const outcome: Record<AppointmentStatus, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  booked: { label: "Booked", variant: "outline" },
  show_up: { label: "Showed up", variant: "secondary" },
  no_show: { label: "No-show", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
}

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function groups(rows: AgendaRow[]): { label: string; rows: AgendaRow[] }[] {
  const result: { label: string; rows: AgendaRow[] }[] = []
  for (const row of rows) {
    const last = result[result.length - 1]
    if (last && last.label === row.dayLabel) last.rows.push(row)
    else result.push({ label: row.dayLabel, rows: [row] })
  }
  return result
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[]
    q?: string | string[]
    page?: string | string[]
    date?: string | string[]
    from?: string | string[]
    to?: string | string[]
  }>
}) {
  const params = await searchParams
  const tab = params.tab === "history" ? "history" : "agenda"
  const q = typeof params.q === "string" ? params.q.trim() : ""
  const rawPage = typeof params.page === "string" ? Number(params.page) : 1
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1

  const today = clinicToday()
  const rangeMode = typeof params.from === "string" || typeof params.to === "string"
  const date = validDay(params.date) ? params.date : today
  const from = validDay(params.from) ? params.from : date
  const to = validDay(params.to) ? params.to : from

  const options = await listAppointmentOptions()
  const agenda = tab === "agenda" ? await listAgenda(q) : null
  const history =
    tab === "history"
      ? await listHistory(page, rangeMode ? { from, to } : { date }, q)
      : null

  const query = q ? `&q=${encodeURIComponent(q)}` : ""
  const agendaHref = `/appointments${q ? `?q=${encodeURIComponent(q)}` : ""}`
  const historyHref = `/appointments?tab=history${query}`
  const periodLabel =
    rangeMode && from !== to
      ? `${formatClinicDay(from)} – ${formatClinicDay(to)}`
      : formatClinicDay(rangeMode ? from : date)

  const late = agenda?.filter((row) => row.isLate).length ?? 0
  const first = history && history.total > 0 ? (history.page - 1) * APPOINTMENTS_PER_PAGE + 1 : 0
  const last = history ? Math.min(history.page * APPOINTMENTS_PER_PAGE, history.total) : 0
  const pageHref = (target: number) =>
    rangeMode
      ? `/appointments?tab=history&from=${from}&to=${to}&page=${target}${query}`
      : `/appointments?tab=history&date=${date}&page=${target}${query}`

  const activeClass = "bg-primary text-primary-foreground"
  const idleClass = "text-muted-foreground hover:bg-muted hover:text-foreground"

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Appointments</h2>
        <p className="text-sm text-muted-foreground">
          Who is coming, what they expect, and what happened. The bot books; you mark the outcome.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            <Link
              href={agendaHref}
              className={`flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors ${
                tab === "agenda" ? activeClass : idleClass
              }`}
            >
              Agenda
            </Link>
            <Link
              href={historyHref}
              className={`flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors ${
                tab === "history" ? activeClass : idleClass
              }`}
            >
              History
            </Link>
          </div>
          {tab === "agenda" ? (
            <PatientSearch defaultValue={q} />
          ) : (
            <PatientSearch
              defaultValue={q}
              hidden={{
                tab: "history",
                ...(rangeMode ? { from, to } : { date }),
              }}
            />
          )}
        </div>
        <NewAppointmentDialog categories={options.categories} sources={options.sources} />
      </div>

      {tab === "agenda" ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {agenda && agenda.length > 0
                ? `${agenda.length} booked, ${late > 0 ? `${late} waiting to be marked` : "none late"}`
                : "Nothing booked"}
            </span>
            {late > 0 ? <Badge variant="destructive">{late} late</Badge> : null}
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Hour</TableHead>
                  <TableHead className="w-56">Patient</TableHead>
                  <TableHead className="w-36">Expects</TableHead>
                  <TableHead className="w-28">Source</TableHead>
                  <TableHead className="w-20">Via</TableHead>
                  <TableHead className="w-64 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!agenda || agenda.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="p-0">
                      <Empty className="rounded-none border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <CalendarDays />
                          </EmptyMedia>
                          <EmptyTitle>No bookings waiting</EmptyTitle>
                          <EmptyDescription>
                            The bot's bookings land here, and the desk books the rest.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  groups(agenda).map((group) => (
                    <Fragment key={group.label}>
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-muted/40 py-1.5 text-xs font-medium">
                          {group.label}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="tabular-nums">{row.slotLabel}</span>
                              {row.isToday ? <Badge>Today</Badge> : null}
                              {row.isLate ? <Badge variant="destructive">Late</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell className="truncate">
                            {row.patientId ? (
                              <Link
                                href={`/patients/${row.patientId}`}
                                className="underline-offset-4 hover:underline"
                                title={row.patientName}
                              >
                                {row.patientName}
                              </Link>
                            ) : (
                              <span title={row.patientName}>{row.patientName}</span>
                            )}
                          </TableCell>
                          <TableCell className="truncate text-muted-foreground" title={row.categoryLabel}>
                            {row.categoryLabel}
                          </TableCell>
                          <TableCell className="truncate text-muted-foreground" title={row.sourceLabel}>
                            {row.sourceLabel}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.via === "bot" ? "secondary" : "outline"}>
                              {row.via === "bot" ? "Bot" : "Desk"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <AppointmentRowActions
                              id={row.id}
                              patientName={row.patientName}
                              dayLabel={row.dayLabel}
                              slotLabel={row.slotLabel}
                              slotValue={row.slotValue}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <DateFilter
                mode={rangeMode ? "range" : "day"}
                date={date}
                from={from}
                to={to}
                basePath="/appointments"
                params={{ tab: "history" }}
              />
              {!(rangeMode ? from === today && to === today : date === today) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link
                      href={
                        rangeMode
                          ? `/appointments?tab=history&from=${today}&to=${today}`
                          : `/appointments?tab=history&date=${today}`
                      }
                    />
                  }
                >
                  Today
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {history && history.total > 0
                  ? `${first}–${last} of ${history.total} bookings`
                  : "No bookings"}
              </span>
              <Badge variant="secondary">{periodLabel}</Badge>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">When</TableHead>
                  <TableHead className="w-56">Patient</TableHead>
                  <TableHead className="w-32">Expects</TableHead>
                  <TableHead className="w-24">Via</TableHead>
                  <TableHead className="w-28">Outcome</TableHead>
                  <TableHead className="w-48">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history || history.rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="p-0">
                      <Empty className="rounded-none border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <CalendarDays />
                          </EmptyMedia>
                          <EmptyTitle>Nothing marked in {periodLabel}</EmptyTitle>
                          <EmptyDescription>
                            Mark a booking from the agenda to see it here.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  history.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-muted-foreground">{row.dayLabel}</span>{" "}
                        <span className="tabular-nums">{row.slotLabel}</span>
                      </TableCell>
                      <TableCell className="truncate">
                        {row.patientId ? (
                          <Link
                            href={`/patients/${row.patientId}`}
                            className="underline-offset-4 hover:underline"
                            title={row.patientName}
                          >
                            {row.patientName}
                          </Link>
                        ) : (
                          <span title={row.patientName}>{row.patientName}</span>
                        )}
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground" title={row.categoryLabel}>
                        {row.categoryLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.via === "bot" ? "secondary" : "outline"}>
                          {row.via === "bot" ? "Bot" : "Desk"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={outcome[row.status].variant}>
                          {outcome[row.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground" title={row.cancelReason ?? undefined}>
                        {row.cancelReason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {history && history.pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={history.page <= 1}
                nativeButton={false}
                render={<Link href={pageHref(history.page - 1)} />}
              >
                <ChevronLeft data-icon="inline-start" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {history.page} of {history.pageCount}
              </span>
              <Button
                variant="outline"
                disabled={history.page >= history.pageCount}
                nativeButton={false}
                render={<Link href={pageHref(history.page + 1)} />}
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
