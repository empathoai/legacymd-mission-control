"use client"

import { format, parseISO } from "date-fns"
import { CalendarIcon, CalendarPlus, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import {
  bookAppointment,
  searchAppointmentCustomers,
  type AppointmentCustomer,
} from "@/app/(app)/appointments/actions"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { SourcePicker } from "@/components/source-picker"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AppointmentOption } from "@/lib/appointments"
import { clinicToday, clinicWallToUtcIso } from "@/lib/dates"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

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

export function NewAppointmentDialog({
  categories,
  sources,
}: {
  categories: AppointmentOption[]
  sources: AppointmentOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [patientQuery, setPatientQuery] = useState("")
  const [matches, setMatches] = useState<AppointmentCustomer[]>([])
  const [patient, setPatient] = useState<AppointmentCustomer | null>(null)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newBirth, setNewBirth] = useState("")
  const [day, setDay] = useState(clinicToday())
  const [slot, setSlot] = useState("09:00")
  const [categoryId, setCategoryId] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [dayOpen, setDayOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<
    "patient" | "category" | "source" | null
  >(null)
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const term = patientQuery.trim()
    if (term.length < 2) {
      setMatches([])
      return
    }
    timer.current = setTimeout(async () => {
      setMatches(await searchAppointmentCustomers(term))
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [patientQuery])

  function reset(next: boolean) {
    setOpen(next)
    if (!next) return
    setPatientQuery("")
    setMatches([])
    setPatient(null)
    setNewName("")
    setNewPhone("")
    setNewBirth("")
    setDay(clinicToday())
    setSlot("09:00")
    setCategoryId("")
    setSourceId("")
    setError(null)
    setErrorField(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setErrorField(null)

    const name = patient?.fullName ?? newName.trim()
    if (!patient && name.length < 2) {
      setError("Search the patient, or type a name of at least 2 letters.")
      setErrorField("patient")
      return
    }
    if (!categoryId) {
      setError("Pick what they expect.")
      setErrorField("category")
      return
    }
    if (!sourceId) {
      setError("Pick how they found us.")
      setErrorField("source")
      return
    }

    const [hour, minute] = slot.split(":").map(Number)

    startTransition(async () => {
      const result = await bookAppointment({
        customerId: patient?.id ?? null,
        name,
        phone: patient?.phone ?? (newPhone.trim() || null),
        birthDate: patient ? null : newBirth.trim() || null,
        scheduledAt: clinicWallToUtcIso(day, hour, minute),
        categoryId,
        sourceId,
      })

      if (!result.ok) {
        setErrorField(null)
        setError(result.error)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={() => reset(true)}>
        <CalendarPlus data-icon="inline-start" />
        New booking
      </Button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>New booking</DialogTitle>
              <DialogDescription>
                The patient, the slot and what they expect. A past slot is allowed.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {patient ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span className="flex flex-col text-sm">
                    <span className="font-medium">{patient.fullName}</span>
                    <span className="text-muted-foreground">
                      {patient.phone ?? "no phone"} · {patient.visits} visit
                      {patient.visits === 1 ? "" : "s"} ·{" "}
                      {money.format(patient.balance)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPatient(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="appointment-patient">Search by name</Label>
                    <Input
                      id="appointment-patient"
                      value={patientQuery}
                      onChange={(event) => setPatientQuery(event.target.value)}
                      placeholder="Type at least 2 letters"
                      autoFocus
                      aria-invalid={errorField === "patient" || undefined}
                      aria-describedby={
                        errorField === "patient" ? "appointment-patient-error" : undefined
                      }
                    />
                    {errorField === "patient" && error ? (
                      <p
                        id="appointment-patient-error"
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {error}
                      </p>
                    ) : null}
                    {matches.length > 0 ? (
                      <ul className="max-h-44 divide-y overflow-auto rounded-lg border text-sm">
                        {matches.map((match) => (
                          <li key={match.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setPatient(match)
                                setPatientQuery("")
                                setMatches([])
                              }}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                            >
                              <span className="flex flex-col">
                                <span className="font-medium">{match.fullName}</span>
                                <span className="text-muted-foreground">
                                  {match.phone ?? "no phone"} · {match.visits} visit
                                  {match.visits === 1 ? "" : "s"}
                                </span>
                              </span>
                              <span className="flex flex-col items-end">
  <span className="text-xs text-muted-foreground">balance</span>
  <span className="text-sm tabular-nums">{money.format(match.balance)}</span>
</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="grid gap-2 rounded-md border border-dashed p-3">
                    <span className="text-sm font-medium">
                      Not in the list? Create the patient
                    </span>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="new-patient-name" className="text-xs">
                          Full name
                        </Label>
                        <Input
                          id="new-patient-name"
                          value={newName}
                          onChange={(event) => setNewName(event.target.value)}
                          placeholder="First and last name"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="new-patient-phone" className="text-xs">
                            Phone
                          </Label>
                          <Input
                            id="new-patient-phone"
                            value={newPhone}
                            onChange={(event) =>
                              setNewPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
                            }
                            placeholder="3055551234"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="new-patient-birth" className="text-xs">
                            Birth date (optional)
                          </Label>
                          <Input
                            id="new-patient-birth"
                            type="date"
                            value={newBirth}
                            max={clinicToday()}
                            onChange={(event) => setNewBirth(event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Day</Label>
                  <Popover open={dayOpen} onOpenChange={setDayOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start px-2.5 font-normal"
                        >
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
                  <Label htmlFor="appointment-slot">Time</Label>
                  <Select
                    items={SLOTS.map((value) => ({ label: to12h(value), value }))}
                    value={slot}
                    onValueChange={(next) => setSlot((next as string) ?? "09:00")}
                  >
                    <SelectTrigger id="appointment-slot" className="w-full">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="appointment-category">Expects</Label>
                  <Select
                    items={categories.map((category) => ({
                      label: category.label,
                      value: category.id,
                    }))}
                    value={categoryId || null}
                    onValueChange={(next) => setCategoryId((next as string | null) ?? "")}
                  >
                    <SelectTrigger
                      id="appointment-category"
                      className="w-full"
                      aria-invalid={errorField === "category" || undefined}
                    >
                      <SelectValue placeholder="What they are coming for" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errorField === "category" && error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="appointment-source">How did they find us?</Label>
                  <SourcePicker
                    sources={sources}
                    value={sourceId}
                    onChange={setSourceId}
                    id="appointment-source"
                  />
                  {errorField === "source" && error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>

              {error && errorField === null ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Booking…" : "Book"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
