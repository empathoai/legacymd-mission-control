import {
  CadenceSwitcher,
  type DashboardView,
} from "@/components/dashboard/cadence-switcher"
import { DailyView } from "@/components/dashboard/daily-view"
import { MonthlyView } from "@/components/dashboard/monthly-view"
import { WeeklyView } from "@/components/dashboard/weekly-view"
import { PageHeader } from "@/components/page-header"
import {
  getDailyDashboard,
  getMonthlyDashboard,
  getWeeklyDashboard,
} from "@/lib/dashboard"
import { clinicToday, formatClinicDay } from "@/lib/dates"
import { formatMonthLabel } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[]
    date?: string | string[]
    month?: string | string[]
  }>
}) {
  const params = await searchParams
  const rawView = typeof params.view === "string" ? params.view : "daily"
  const view: DashboardView =
    rawView === "weekly" || rawView === "monthly" ? rawView : "daily"
  const today = clinicToday()
  const dateParam = typeof params.date === "string" ? params.date : undefined
  const monthParam = typeof params.month === "string" ? params.month : undefined

  if (view === "weekly") {
    const data = await getWeeklyDashboard(dateParam)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Weekly Sales & Mix"
          description={`${formatClinicDay(data.from)} – ${formatClinicDay(data.to)} · revenue pace, average ticket, category mix and acquisition sources.`}
          action={
            <CadenceSwitcher view="weekly" activeDate={data.to} today={today} />
          }
        />
        <WeeklyView data={data} />
      </div>
    )
  }

  if (view === "monthly") {
    const data = await getMonthlyDashboard(monthParam)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Monthly Executive P&L"
          description={`${formatMonthLabel(data.selectedMonth)} · net revenue, unit-economics margin, CAC/ROAS and retention.`}
          action={
            <CadenceSwitcher
              view="monthly"
              selectedMonth={data.selectedMonth}
              availableMonths={data.availableMonths}
            />
          }
        />
        <MonthlyView data={data} />
      </div>
    )
  }

  const data = await getDailyDashboard(dateParam ?? today)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Daily Operations"
        description={`${formatClinicDay(data.date)} · sales, cash drawer and due collections.`}
        action={
          <CadenceSwitcher view="daily" activeDate={data.date} today={today} />
        }
      />
      <DailyView data={data} />
    </div>
  )
}
