"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, UserPlus } from "lucide-react"

import { createCustomer } from "@/app/(app)/patients/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Outcome =
  | { kind: "idle" }
  | { kind: "created"; name: string }
  | { kind: "exists"; name: string; phone: string | null }
  | { kind: "error"; message: string }

export function PatientForm() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setOutcome({ kind: "idle" })

    if (name.trim().length < 2) {
      setOutcome({ kind: "error", message: "A name of at least 2 characters is required." })
      return
    }

    const digits = phone.replace(/\D/g, "")
    if (phone.trim() !== "" && !(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
      setOutcome({
        kind: "error",
        message: "Enter a 10-digit phone number, for example 3055551234.",
      })
      return
    }

    startTransition(async () => {
      const result = await createCustomer({
        name,
        phone,
        birthDate,
      })

      if (result.ok) {
        setOutcome({ kind: "created", name: result.name })
        setName("")
        setPhone("")
        setBirthDate("")
        return
      }

      if (result.existing) {
        setOutcome({
          kind: "exists",
          name: result.existing.name,
          phone: result.existing.phone,
        })
        return
      }

      setOutcome({ kind: "error", message: result.error })
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="patient-name">Name</Label>
        <Input
          id="patient-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="patient-phone">Phone (optional)</Label>
        <Input
          id="patient-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={11}
          placeholder="3055551234"
          value={phone}
          onChange={(event) =>
            setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
          }
        />
        <p className="text-xs text-muted-foreground">
          Digits only: 10, or 11 starting with 1.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="patient-birth">Birth date (optional)</Label>
        <Input
          id="patient-birth"
          type="date"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          It eases the handoff to Patient Fusion. The official chart stays there.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          <UserPlus data-icon="inline-start" />
          {pending ? "Creating…" : "Create patient"}
        </Button>
      </div>

      {outcome.kind === "created" ? (
        <div className="flex items-start gap-2 rounded-lg border p-4 text-sm">
          <CheckCircle2 className="mt-0.5 text-primary" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{outcome.name} was created.</span>
            <span className="text-muted-foreground">
              Can be booked or sold to right away.
            </span>
          </div>
        </div>
      ) : null}

      {outcome.kind === "exists" ? (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed p-4 text-sm">
          <span className="font-medium">That patient is already in the master.</span>
          <span className="text-muted-foreground">
            {outcome.name}
            {outcome.phone ? ` · ${outcome.phone}` : ""}
          </span>
          <span className="text-muted-foreground">
            Search in the report instead of creating a second one.
          </span>
        </div>
      ) : null}

      {outcome.kind === "error" ? (
        <p className="text-sm text-destructive">{outcome.message}</p>
      ) : null}
    </form>
  )
}
