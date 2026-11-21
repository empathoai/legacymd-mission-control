"use client"

import { addDays, format, parseISO } from "date-fns"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Receipt,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMonthLabel } from "@/lib/format"

export type DashboardView = "daily" | "weekly" | "monthly"

function shiftIso(iso: string, delta: number): string {
  return format(addDays(parseISO(iso), delta), "yyyy-MM-dd")
}

export function CadenceSwitcher({
  view,
  activeDate,
  today,
  selectedMonth,
  availableMonths,
}: {
  view: DashboardView
  activeDate?: string
  today?: string
  selectedMonth?: string
  availableMonths?: string[]
}) {
  const router = useRouter()

  function onViewChange(next: string[]) {
    const picked = next[0] as DashboardView | undefined
    if (!picked || picked === view) return
    if (picked === "daily") {
      router.push("/")
    } else if (picked === "weekly") {
      router.push("/?view=weekly")
    } else {
      const m = selectedMonth ? `&month=${selectedMonth}` : ""
      router.push(`/?view=monthly${m}`)
    }
  }

  function onMonthChange(next: string | null) {
    if (!next) return
    router.push(`/?view=monthly&month=${next}`)
  }

  function stepDate(delta: number) {
    if (!activeDate) return
    const nextDate = shiftIso(activeDate, delta)
    if (view === "daily") {
      router.push(nextDate === today ? "/" : `/?date=${nextDate}`)
    } else if (view === "weekly") {
      router.push(nextDate === today ? "/?view=weekly" : `/?view=weekly&date=${nextDate}`)
    }
  }

  const isAtToday = Boolean(activeDate && today && activeDate >= today)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(view === "daily" || view === "weekly") && activeDate ? (
        <div className="inline-flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={view === "daily" ? "Previous day" : "Previous week"}
            onClick={() => stepDate(view === "daily" ? -1 : -7)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {!isAtToday && today ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(view === "daily" ? "/" : "/?view=weekly")
              }
            >
              Today
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="outline"
            disabled={isAtToday}
            aria-label={view === "daily" ? "Next day" : "Next week"}
            onClick={() => stepDate(view === "daily" ? 1 : 7)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {view === "monthly" && availableMonths && availableMonths.length > 0 ? (
        <Select
          value={selectedMonth ?? availableMonths[0]}
          onValueChange={onMonthChange}
        >
          <SelectTrigger size="sm" className="min-w-[165px]">
            <SelectValue placeholder="Select month">
              {(value: string) => (value ? formatMonthLabel(value) : "Select month")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[view]}
        onValueChange={onViewChange}
      >
        <ToggleGroupItem value="daily" className="gap-1.5">
          <CalendarDays className="size-3.5" />
          Daily
        </ToggleGroupItem>
        <ToggleGroupItem value="weekly" className="gap-1.5">
          <TrendingUp className="size-3.5" />
          Weekly
        </ToggleGroupItem>
        <ToggleGroupItem value="monthly" className="gap-1.5">
          <Receipt className="size-3.5" />
          Monthly
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
