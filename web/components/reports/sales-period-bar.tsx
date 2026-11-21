"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

export type SalesPresetKey = "30d" | "90d" | "ytd" | "all" | "custom"

export function SalesPeriodBar({
  activePreset,
  presets,
  from,
  to,
  today,
}: {
  activePreset: SalesPresetKey
  presets: { key: Exclude<SalesPresetKey, "custom">; label: string; href: string }[]
  from: string
  to: string
  today: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraftFrom(from)
      setDraftTo(to)
    }
    setOpen(next)
  }

  function applyRange(start: string, end: string) {
    if (!start || !end) return
    const [a, b] = start <= end ? [start, end] : [end, start]
    setOpen(false)
    if (a === b) {
      router.push(`/sales/report?date=${a}`)
    } else {
      router.push(`/sales/report?from=${a}&to=${b}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex h-8 shrink-0 items-center rounded-lg border bg-card p-0.5 text-xs">
        {presets.map((p) => (
          <Link
            key={p.key}
            href={p.href}
            className={`inline-flex h-full items-center rounded-md px-2.5 font-medium transition-colors ${
              activePreset === p.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              className={
                activePreset === "custom"
                  ? "border-sidebar-primary/60 bg-accent/60"
                  : undefined
              }
            />
          }
        >
          <CalendarDays data-icon="inline-start" />
          Custom
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <PopoverHeader className="pb-1">
            <PopoverTitle className="text-sm font-medium">
              Custom date range
            </PopoverTitle>
          </PopoverHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              applyRange(draftFrom, draftTo)
            }}
          >
            <div className="grid gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="sales-from" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="sales-from"
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sales-to" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="sales-to"
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyRange(today, today)}
              >
                Today only
              </Button>
              <Button type="submit" size="sm">
                Apply
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
