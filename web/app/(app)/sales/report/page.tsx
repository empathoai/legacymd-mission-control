import { PageHeader } from "@/components/page-header"
import {
  SalesPeriodBar,
  type SalesPresetKey,
} from "@/components/reports/sales-period-bar"
import { SalesReportView } from "@/components/reports/sales-report-view"
import { clinicToday, formatClinicDay } from "@/lib/dates"
import { getSalesReport } from "@/lib/reports"

export const dynamic = "force-dynamic"

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function shiftDays(isoDay: string, delta: number): string {
  const dt = new Date(`${isoDay}T12:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string | string[]
    from?: string | string[]
    to?: string | string[]
  }>
}) {
  const params = await searchParams
  const today = clinicToday()
  const hasDate = validDay(params.date)
  const hasRange = validDay(params.from) || validDay(params.to)
  const mode = hasRange ? "range" : hasDate ? "day" : "all"

  const date = validDay(params.date) ? params.date : today
  const from = validDay(params.from) ? params.from : date
  const to = validDay(params.to) ? params.to : from

  const data = await getSalesReport(
    mode === "day"
      ? { from: date, to: date }
      : mode === "range"
        ? { from, to }
        : undefined
  )

  const periodLabel =
    mode === "all"
      ? "All history"
      : mode === "day"
        ? formatClinicDay(date)
        : `${formatClinicDay(from)} – ${formatClinicDay(to)}`

  const d30From = shiftDays(today, -29)
  const d90From = shiftDays(today, -89)
  const ytdFrom = `${today.slice(0, 4)}-01-01`

  const activePreset: SalesPresetKey =
    mode === "all"
      ? "all"
      : mode === "range" && to === today
        ? from === d30From
          ? "30d"
          : from === d90From
            ? "90d"
            : from === ytdFrom
              ? "ytd"
              : "custom"
        : "custom"

  const presets = [
    { key: "30d" as const, label: "30D", href: `/sales/report?from=${d30From}&to=${today}` },
    { key: "90d" as const, label: "90D", href: `/sales/report?from=${d90From}&to=${today}` },
    { key: "ytd" as const, label: "YTD", href: `/sales/report?from=${ytdFrom}&to=${today}` },
    { key: "all" as const, label: "All", href: "/sales/report" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales report"
        description={`${periodLabel} · revenue trends, weekday cadence, commercial mix and collection pace.`}
        action={
          <SalesPeriodBar
            activePreset={activePreset}
            presets={presets}
            from={from}
            to={to}
            today={today}
          />
        }
      />

      <SalesReportView data={data} mode={mode} />
    </div>
  )
}
