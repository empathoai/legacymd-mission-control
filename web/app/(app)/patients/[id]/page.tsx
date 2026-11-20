import Link from "next/link"
import { ArrowLeft, CalendarDays, Receipt } from "lucide-react"

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
import { getCustomerDetail } from "@/lib/customers"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatDay(value: string | null) {
  return value ? day.format(new Date(`${value}T12:00:00`)) : "—"
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  )
}

const statusLabel: Record<string, string> = {
  booked: "Booked",
  show_up: "Show up",
  no_show: "No show",
  cancelled: "Cancelled",
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = await getCustomerDetail(id)

  if (!patient) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" nativeButton={false} render={<Link href="/patients/report" />}>
          <ArrowLeft data-icon="inline-start" />
          Patient report
        </Button>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>Patient not found</EmptyTitle>
            <EmptyDescription>
              It may have been removed. Go back to the report and search again.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          className="w-fit"
          nativeButton={false}
          render={<Link href="/patients/report" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Patient report
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{patient.fullName}</h2>
          {patient.isOverdue ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : patient.balance > 0 ? (
            <Badge>Open</Badge>
          ) : patient.visits === 0 ? (
            <Badge variant="secondary">No visits</Badge>
          ) : (
            <Badge variant="secondary">Settled</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {patient.phone ?? "no phone"} · born {formatDay(patient.birthDate)} · patient since{" "}
          {formatMonth(patient.createdAt.slice(0, 10))}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Spent" value={money.format(patient.spentTotal)} />
        <Stat label="Returns" value={money.format(patient.refundedTotal)} />
        <Stat label="Balance" value={money.format(patient.balance)} />
        <Stat label="Visits" value={String(patient.visits)} />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
        <span>Last visit: {formatDay(patient.lastVisitOn)}</span>
        <span>Next due: {formatDay(patient.nextDueOn)}</span>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Purchases</h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Refunded</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patient.sales.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No purchase yet.
                  </TableCell>
                </TableRow>
              ) : (
                patient.sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDay(sale.occurredOn)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {sale.items
                        .map((item) =>
                          item.quantity > 1
                            ? `${item.itemName} ×${item.quantity}`
                            : item.itemName
                        )
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(sale.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(sale.paid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(sale.refunded)}
                    </TableCell>
                    <TableCell>
                      {sale.voided ? (
                        <Badge variant="destructive">Voided</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {patient.appointments.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Appointments</h3>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patient.appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDay(appointment.scheduledOn)}
                    </TableCell>
                    <TableCell>
                      {statusLabel[appointment.status] ?? appointment.status}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="size-4" />
        Selling and booking from this screen arrive with those modules.
      </p>
    </div>
  )
}
