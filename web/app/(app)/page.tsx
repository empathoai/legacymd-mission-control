import Link from "next/link"
import { CalendarDays, Receipt, Undo2, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clinicToday, formatClinicDay } from "@/lib/dates"
import { getDashboardMetrics } from "@/lib/dashboard"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const modules = [
  {
    href: "/sales/new",
    icon: Receipt,
    title: "New sale",
    description: "Pick the patient, add what was sold, take the money.",
  },
  {
    href: "/appointments",
    icon: CalendarDays,
    title: "Appointments",
    description: "Who is coming, who showed up, who did not.",
  },
  {
    href: "/patients/report",
    icon: Users,
    title: "Patients",
    description: "Search the master, read balances and the next due date.",
  },
  {
    href: "/open-items",
    icon: Undo2,
    title: "Open items",
    description: "The money still expected, month by month.",
  },
]

export default async function Page() {
  const metrics = await getDashboardMetrics()

  const cards = [
    {
      label: "Sold this month",
      value: money.format(metrics.sold),
      hint:
        metrics.newPatients === 0
          ? "No new patients yet this month"
          : `${metrics.newPatients} new patient${metrics.newPatients === 1 ? "" : "s"} this month`,
    },
    {
      label: "Collected this month",
      value: money.format(metrics.collected),
      hint:
        metrics.sold - metrics.collected > 0.005
          ? `${money.format(metrics.sold - metrics.collected)} still to come`
          : "Everything sold is collected",
    },
    {
      label: "Owed to the clinic",
      value: money.format(metrics.owed),
      hint: metrics.owed > 0.005 ? "Open across every patient" : "Nobody owes anything",
    },
    {
      label: "Show-up rate",
      value: metrics.showUpRate === null ? "—" : `${Math.round(metrics.showUpRate * 100)}%`,
      hint:
        metrics.showUpRate === null
          ? "No booking has been marked yet"
          : `${metrics.resolvedAppointments} resolved this month`,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
          <p className="text-sm text-muted-foreground">
            {formatClinicDay(clinicToday())} · the clinic&apos;s day, without the workbook.
          </p>
        </div>
        <Link
          href="/appointments"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {metrics.comingToday === 0
            ? "No bookings today"
            : `${metrics.comingToday} booking${metrics.comingToday === 1 ? "" : "s"} today`}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-accent/50">
              <CardHeader>
                <module.icon className="text-muted-foreground" />
                <CardTitle>{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
