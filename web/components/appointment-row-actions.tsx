"use client"

import { format, parseISO } from "date-fns"
import { Ban, CalendarClock, CalendarIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  rescheduleAppointmentAction,
  resolveAppointmentAction,
} from "@/app/(app)/appointments/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { clinicToday, clinicWallToUtcIso } from "@/lib/dates"

const SLOTS = Array.from({ length: (19 - 8) * 4 + 1 }, (_, index) => {
  const minutes = 8 * 60 + index * 15
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0")
  const minute = String(minutes % 60).padStart(2, "0")
  return `${hour}:${minute}`
})

function to12h(value: string): string {
  const [hour, minute] = value.split(":").map(Number)
  const suffix = hour >= 12 ? "PM" : "AM"
  const clock = hour % 12 === 0 ? 12 : hour % 12
  return `${clock}:${String(minute).padStart(2, "0")} ${suffix}`
}

type DialogKind = "cancel" | "reschedule" | null

export function AppointmentRowActions({
  id,
  patientName,
  dayLabel,
  slotLabel,
  slotValue,
}: {
  id: string
  patientName: string
  dayLabel: string
  slotLabel: string
  slotValue: string
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [reason, setReason] = useState("")
  const [day, setDay] = useState(clinicToday())
  const [slot, setSlot] = useState("09:00")
  const [dayOpen, setDayOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function openDialog(kind: Exclude<DialogKind, null>) {
    setDialog(kind)
    setReason("")
    setError(null)
    setSlot(slotValue)
    setDay(clinicToday())
  }

  function resolve(status: "show_up" | "no_show") {
    setError(null)
    startTransition(async () => {
      const result = await resolveAppointmentAction(id, status)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function cancel() {
    setError(null)
    if (reason.trim().length < 4) {
      setError("A cancellation needs a reason of at least 4 characters.")
      return
    }
    startTransition(async () => {
      const result = await resolveAppointmentAction(id, "cancelled", reason)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDialog(null)
      router.refresh()
    })
  }

  function reschedule() {
    setError(null)
    if (reason.trim().length < 4) {
      setError("A move needs a reason of at least 4 characters.")
      return
    }
    const [hour, minute] = slot.split(":").map(Number)
    startTransition(async () => {
      const result = await rescheduleAppointmentAction(
        id,
        clinicWallToUtcIso(day, hour, minute),
        reason
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDialog(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button
        variant="outline"
        size="xs"
        disabled={pending}
        onClick={() => resolve("show_up")}
      >
        Show up
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={() => resolve("no_show")}
      >
        No-show
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Reschedule"
        aria-label={`Reschedule ${patientName}`}
        onClick={() => openDialog("reschedule")}
      >
        <CalendarClock />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        title="Cancel the booking"
        aria-label={`Cancel ${patientName}`}
        onClick={() => openDialog("cancel")}
      >
        <Ban />
      </Button>

      {error && dialog === null ? (
        <span className="w-full text-right text-xs text-destructive">{error}</span>
      ) : null}

      <Dialog open={dialog === "cancel"} onOpenChange={(next) => setDialog(next ? "cancel" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel the booking</DialogTitle>
            <DialogDescription>
              {patientName}, {dayLabel} at {slotLabel}. A cancellation is terminal and needs a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Called to cancel, rescheduling, …"
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={pending}>
              {pending ? "Cancelling…" : "Cancel the booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "reschedule"}
        onOpenChange={(next) => setDialog(next ? "reschedule" : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule</DialogTitle>
            <DialogDescription>
              {patientName}, now {dayLabel} at {slotLabel}. A move is audited and cannot go into the past.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>New day</Label>
                <Popover open={dayOpen} onOpenChange={setDayOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="justify-start px-2.5 font-normal">
                        <CalendarIcon data-icon="inline-start" />
                        {format(parseISO(day), "PPP")}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseISO(day)}
                      defaultMonth={parseISO(day)}
                      onSelect={(next) => {
                        if (!next) return
                        setDay(format(next, "yyyy-MM-dd"))
                        setDayOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="move-slot">New time</Label>
                <Select
                  items={SLOTS.map((value) => ({ label: to12h(value), value }))}
                  value={slot}
                  onValueChange={(next) => setSlot((next as string) ?? "09:00")}
                >
                  <SelectTrigger id="move-slot" className="w-full">
                    <SelectValue placeholder="Pick a time" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-72">
                    {SLOTS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {to12h(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="move-reason">Reason</Label>
              <Input
                id="move-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Asked for another day, the doctor is away, …"
                autoFocus
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button onClick={reschedule} disabled={pending}>
              {pending ? "Moving…" : "Move it"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
