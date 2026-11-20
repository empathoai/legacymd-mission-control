"use client"

import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const activeClass = "bg-primary text-primary-foreground"
const idleClass = "text-muted-foreground hover:bg-muted hover:text-foreground"

export type DateFilterMode = "all" | "day" | "range"

export function DateFilter({
  mode,
  date,
  from,
  to,
  basePath = "/sales/details",
  showAll = false,
  params,
}: {
  mode: DateFilterMode
  date: string
  from: string
  to: string
  basePath?: string
  showAll?: boolean
  params?: Record<string, string>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined)

  const daySelected = parseISO(date)
  const rangeSelected: DateRange = { from: parseISO(from), to: parseISO(to) }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) setPendingRange(rangeSelected)
  }

  function href(extra: Record<string, string>) {
    const search = new URLSearchParams({ ...(params ?? {}), ...extra }).toString()
    return search ? `${basePath}?${search}` : basePath
  }

  function go(next: DateFilterMode) {
    if (next === mode) return
    if (next === "all") {
      router.push(href({}))
    } else if (next === "day") {
      router.push(href({ date: from }))
    } else {
      router.push(href({ from, to }))
    }
  }

  function pickDay(next: Date | undefined) {
    if (!next) return
    router.push(href({ date: format(next, "yyyy-MM-dd") }))
    setOpen(false)
  }

  function pickRange(next: DateRange | undefined) {
    setPendingRange(next)
    if (next?.from && next?.to) {
      router.push(
        href({
          from: format(next.from, "yyyy-MM-dd"),
          to: format(next.to, "yyyy-MM-dd"),
        })
      )
      setOpen(false)
    }
  }

  const label =
    mode === "range" && from !== to
      ? `${format(parseISO(from), "LLL dd, y")} – ${format(parseISO(to), "LLL dd, y")}`
      : format(mode === "range" ? parseISO(from) : daySelected, "PPP")

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border bg-muted/30 p-0.5">
        {showAll ? (
          <button
            type="button"
            onClick={() => go("all")}
            className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
              mode === "all" ? activeClass : idleClass
            }`}
          >
            All
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => go("day")}
          className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
            mode === "day" ? activeClass : idleClass
          }`}
        >
          Day
        </button>
        <button
          type="button"
          onClick={() => go("range")}
          className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
            mode === "range" ? activeClass : idleClass
          }`}
        >
          Range
        </button>
      </div>

      {mode !== "all" ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger
            render={
              <Button variant="outline" className="justify-start px-2.5 font-normal">
                <CalendarIcon data-icon="inline-start" />
                {label}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            {mode === "day" ? (
              <Calendar
                mode="single"
                selected={daySelected}
                onSelect={pickDay}
                defaultMonth={daySelected}
              />
            ) : (
              <Calendar
                mode="range"
                selected={pendingRange}
                onSelect={pickRange}
                numberOfMonths={2}
                defaultMonth={rangeSelected.from}
              />
            )}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
