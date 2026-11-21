"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { CheckCircle2, Plus, Search, X } from "lucide-react"

import {
  createSale,
  listBookedAppointments,
  searchSaleCustomers,
  type BookedAppointment,
  type SaleCustomerMatch,
} from "@/app/(app)/sales/actions"
import { createCustomer } from "@/app/(app)/patients/actions"
import { SourcePicker } from "@/components/source-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MethodOption, SellableItem, SourceOption } from "@/lib/sale-entry"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function clinicToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function shortDay(value: string) {
  return day.format(new Date(`${value}T12:00:00`))
}

function kindLabel(item: { kind: string; unitType: string | null }) {
  if (item.unitType === "package") return "Package"
  if (item.unitType === "membership") return "Membership"
  return item.kind.charAt(0).toUpperCase() + item.kind.slice(1)
}

function MethodSelect({
  methods,
  value,
  onValueChange,
  className,
  placeholder = "Choose",
  id,
}: {
  methods: MethodOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  placeholder?: string
  id?: string
}) {
  return (
    <Select
      items={methods.map((method) => ({ label: method.label, value: method.id }))}
      value={value || null}
      onValueChange={(next) => onValueChange((next as string | null) ?? "")}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {methods.map((method) => (
          <SelectItem key={method.id} value={method.id}>
            {method.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type Line = {
  key: string
  kind: "treatment" | "product" | "service" | "custom"
  itemId: string | null
  code: string | null
  name: string
  unitType: "unit" | "package" | "membership" | null
  quantity: string
  unitPrice: string
}

type Installment = {
  key: string
  methodId: string
  dueOn: string
  amount: string
}

type Outcome = { kind: "idle" } | { kind: "saved"; saleId: string; total: number }

/**
 * The sale in progress lives in sessionStorage, so a trip to the dashboard and
 * back does not cost the front desk a re-typed sale. Not a database draft: the
 * tab owns it, and it dies with the tab.
 */
const DRAFT_KEY = "legacymd:sale-draft:v1"

type SaleDraft = {
  savedAt: number
  customer: SaleCustomerMatch | null
  lines: Line[]
  paymentMode: "full" | "plan"
  paidMethodId: string
  paidToday: string
  installments: Installment[]
  notes: string
  occurredOn: string
  sourceId: string
  newName: string
  newPhone: string
}

export function SaleForm({
  items,
  sources,
  methods,
}: {
  items: SellableItem[]
  sources: SourceOption[]
  methods: MethodOption[]
}) {
  const [customer, setCustomer] = useState<SaleCustomerMatch | null>(null)
  const [patientQuery, setPatientQuery] = useState("")
  const [matches, setMatches] = useState<SaleCustomerMatch[]>([])
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [occurredOn, setOccurredOn] = useState(clinicToday())
  const [sourceId, setSourceId] = useState("")
  const [appointments, setAppointments] = useState<BookedAppointment[]>([])
  const [appointmentId, setAppointmentId] = useState("")
  const [itemQuery, setItemQuery] = useState("")
  const [itemHighlight, setItemHighlight] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [paymentMode, setPaymentMode] = useState<"full" | "plan">("full")
  const [paidMethodId, setPaidMethodId] = useState(
    () => methods.find((m) => m.slug === "cash")?.id ?? methods[0]?.id ?? ""
  )
  const [paidToday, setPaidToday] = useState("")
  const [installments, setInstallments] = useState<Installment[]>([])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" })
  const [restored, setRestored] = useState(false)
  const [pending, startTransition] = useTransition()

  const keyRef = useRef(0)
  const nextKey = () => String(++keyRef.current)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftReady = useRef(false)

  // Restore once, before the save effect below can overwrite the draft with an
  // empty form.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as SaleDraft
        const fresh = Date.now() - (draft.savedAt ?? 0) < 12 * 60 * 60 * 1000
        if (fresh) {
          setCustomer(draft.customer ?? null)
          setLines(Array.isArray(draft.lines) ? draft.lines : [])
          setPaymentMode(draft.paymentMode === "plan" ? "plan" : "full")
          if (draft.paidMethodId) setPaidMethodId(draft.paidMethodId)
          setPaidToday(draft.paidToday ?? "")
          setInstallments(Array.isArray(draft.installments) ? draft.installments : [])
          setNotes(draft.notes ?? "")
          setOccurredOn(draft.occurredOn || clinicToday())
          setSourceId(draft.sourceId ?? "")
          setNewName(draft.newName ?? "")
          setNewPhone(draft.newPhone ?? "")
          const touched =
            Boolean(draft.customer) ||
            (draft.lines?.length ?? 0) > 0 ||
            (draft.installments?.length ?? 0) > 0 ||
            Boolean(draft.notes?.trim()) ||
            Boolean(draft.newName?.trim()) ||
            Boolean(draft.newPhone?.trim())
          setRestored(touched)
        } else {
          sessionStorage.removeItem(DRAFT_KEY)
        }
      }
    } catch {
      // A blocked or corrupt draft must never stop the sale screen.
    }
    draftReady.current = true
  }, [])

  useEffect(() => {
    if (!draftReady.current) return
    const touched =
      Boolean(customer) ||
      lines.length > 0 ||
      installments.length > 0 ||
      Boolean(notes.trim()) ||
      Boolean(newName.trim()) ||
      Boolean(newPhone.trim())
    try {
      if (!touched) {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      const draft: SaleDraft = {
        savedAt: Date.now(),
        customer,
        lines,
        paymentMode,
        paidMethodId,
        paidToday,
        installments,
        notes,
        occurredOn,
        sourceId,
        newName,
        newPhone,
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Storage full or blocked: the sale still works.
    }
  }, [
    customer,
    lines,
    paymentMode,
    paidMethodId,
    paidToday,
    installments,
    notes,
    occurredOn,
    sourceId,
    newName,
    newPhone,
  ])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (lines.length === 0) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [lines.length])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const term = patientQuery.trim()
    if (term.length < 2) {
      setMatches([])
      return
    }
    timer.current = setTimeout(async () => {
      setMatches(await searchSaleCustomers(term))
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [patientQuery])

  useEffect(() => {
    if (!customer) {
      setAppointments([])
      setAppointmentId("")
      return
    }
    let active = true
    listBookedAppointments(customer.id).then((list) => {
      if (active) {
        setAppointments(list)
        setAppointmentId("")
      }
    })
    return () => {
      active = false
    }
  }, [customer])

  const firstVisit = customer?.visits === 0

  const lineTotal = (line: Line) =>
    r2((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0))

  const saleTotal = r2(lines.reduce((sum, line) => sum + lineTotal(line), 0))
  const paidTodayValue =
    paymentMode === "full" ? saleTotal : r2(parseFloat(paidToday) || 0)
  const remaining = r2(saleTotal - paidTodayValue)
  const installmentsTotal = r2(
    installments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  )
  const scheduleGap = r2(remaining - installmentsTotal)

  const term = itemQuery.trim().toLowerCase()
  const itemMatches = term
    ? items
        .filter(
          (item) =>
            item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)
        )
        .sort((a, b) => {
          const priced = (item: { price: number }) => (item.price > 0 ? 0 : 1)
          if (priced(a) !== priced(b)) return priced(a) - priced(b)
          const starts = (item: { name: string }) =>
            item.name.toLowerCase().startsWith(term) ? 0 : 1
          if (starts(a) !== starts(b)) return starts(a) - starts(b)
          return a.name.localeCompare(b.name)
        })
        .slice(0, 8)
    : []

  function selectCustomer(match: SaleCustomerMatch) {
    setCustomer(match)
    setPatientQuery("")
    setMatches([])
    setSourceId("")
  }

  function clearCustomer() {
    setCustomer(null)
    setSourceId("")
    setAppointments([])
    setAppointmentId("")
  }

  function addItem(item: SellableItem) {
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        kind: item.kind,
        itemId: item.itemId,
        code: item.code,
        name: item.name,
        unitType: item.unitType,
        quantity: "1",
        unitPrice: String(item.price),
      },
    ])
    setItemQuery("")
  }

  function addCustom() {
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        kind: "custom",
        itemId: null,
        code: null,
        name: "",
        unitType: null,
        quantity: "1",
        unitPrice: "0",
      },
    ])
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  function selectFullPayment() {
    setPaymentMode("full")
    setPaidToday("")
    setInstallments([])
    setError(null)
  }

  function selectPlanPayment() {
    setPaymentMode("plan")
    setPaidToday("0")
    setInstallments([])
    setError(null)
  }

  function addInstallment() {
    const gap = Math.max(0, scheduleGap)
    const method = methods.find((m) => m.slug === "stripe") ?? methods[0]
    setInstallments((prev) => [
      ...prev,
      {
        key: nextKey(),
        methodId: method?.id ?? "",
        dueOn: occurredOn,
        amount: gap > 0 ? String(gap) : "",
      },
    ])
  }

  function updateInstallment(key: string, patch: Partial<Installment>) {
    setInstallments((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }

  function removeInstallment(key: string) {
    setInstallments((prev) => prev.filter((item) => item.key !== key))
  }

  function buildPayments() {
    if (paymentMode === "full") {
      return [
        {
          methodId: paidMethodId,
          dueOn: occurredOn,
          amount: r2(saleTotal),
          collected: r2(saleTotal),
        },
      ]
    }
    const rows: {
      methodId: string
      dueOn: string
      amount: number
      collected: number
    }[] = []
    if (paidTodayValue > 0) {
      rows.push({
        methodId: paidMethodId,
        dueOn: occurredOn,
        amount: r2(paidTodayValue),
        collected: r2(paidTodayValue),
      })
    }
    for (const item of installments) {
      rows.push({
        methodId: item.methodId,
        dueOn: item.dueOn,
        amount: r2(parseFloat(item.amount)),
        collected: 0,
      })
    }
    return rows
  }

  function resetForm() {
    setCustomer(null)
    setPatientQuery("")
    setMatches([])
    setNewName("")
    setNewPhone("")
    setSourceId("")
    setAppointments([])
    setAppointmentId("")
    setItemQuery("")
    setLines([])
    setPaymentMode("full")
    setPaidToday("")
    setInstallments([])
    setNotes("")
  }

  function onCreateNew() {
    if (newName.trim().length < 2) {
      setError("A name of at least 2 characters is required.")
      return
    }
    startTransition(async () => {
      const result = await createCustomer({ name: newName, phone: newPhone || null })
      if (result.ok) {
        selectCustomer({
          id: result.id,
          fullName: result.name,
          phone: newPhone || null,
          visits: 0,
          balance: 0,
          lastVisitOn: null,
        })
        setNewName("")
        setNewPhone("")
        setError(null)
      } else {
        setError(result.error)
      }
    })
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setOutcome({ kind: "idle" })

    if (!customer) {
      setError("Select a patient first.")
      return
    }
    if (firstVisit && !sourceId) {
      setError("A new patient needs a source.")
      return
    }
    if (lines.length === 0) {
      setError("Add at least one line.")
      return
    }
    for (const line of lines) {
      if (line.kind === "custom" && line.name.trim().length < 2) {
        setError("Every custom line needs a description.")
        return
      }
      const quantity = parseFloat(line.quantity)
      const price = parseFloat(line.unitPrice)
      if (!(quantity > 0)) {
        setError("Every line needs a quantity above zero.")
        return
      }
      if (!Number.isFinite(price) || price < 0) {
        setError("Every line needs a price of zero or more.")
        return
      }
    }
    if (saleTotal <= 0) {
      setError("The sale needs a positive total.")
      return
    }
    if (paymentMode === "full") {
      if (!paidMethodId) {
        setError("Choose how the patient paid.")
        return
      }
    } else {
      if (
        !Number.isFinite(paidTodayValue) ||
        paidTodayValue < 0 ||
        paidTodayValue > saleTotal + 1e-9
      ) {
        setError("The amount paid today must be between zero and the sale total.")
        return
      }
      if (paidTodayValue > 0 && !paidMethodId) {
        setError("Choose how the amount paid today was received.")
        return
      }
      for (const item of installments) {
        if (!item.methodId) {
          setError("Every installment needs a method.")
          return
        }
        if (!(parseFloat(item.amount) > 0)) {
          setError("Every installment needs a positive amount.")
          return
        }
        if (!item.dueOn) {
          setError("Every installment needs a due date.")
          return
        }
      }
      if (Math.abs(scheduleGap) > 0.005) {
        setError(
          scheduleGap > 0
            ? `${money.format(scheduleGap)} is still unscheduled.`
            : `The schedule exceeds the remaining amount by ${money.format(-scheduleGap)}.`
        )
        return
      }
    }

    startTransition(async () => {
      const result = await createSale({
        customerId: customer.id,
        occurredOn,
        sourceId: firstVisit ? sourceId : null,
        appointmentId: appointmentId || null,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          kind: line.kind,
          itemId: line.itemId,
          categoryId: null,
          description: line.kind === "custom" ? line.name.trim() : null,
          quantity: r2(parseFloat(line.quantity)),
          unitPrice: r2(parseFloat(line.unitPrice)),
        })),
        payments: buildPayments(),
      })

      if (result.ok) {
        setOutcome({ kind: "saved", saleId: result.saleId, total: saleTotal })
        resetForm()
        setRestored(false)
        try {
          sessionStorage.removeItem(DRAFT_KEY)
        } catch {}
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">New sale</h2>
        <p className="text-sm text-muted-foreground">
          Pick the patient, add what was sold, then how it is being paid.
        </p>
      </div>

      {restored ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">
            This sale was kept in this browser. Nothing was lost.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetForm()
              setRestored(false)
              try {
                sessionStorage.removeItem(DRAFT_KEY)
              } catch {}
            }}
          >
            Start over
          </Button>
        </div>
      ) : null}

      {/* Patient */}
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Patient</h3>
          {customer ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearCustomer}>
              Change
            </Button>
          ) : null}
        </div>

        {customer ? (
          <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{customer.fullName}</span>
              {customer.phone ? (
                <span className="text-muted-foreground">{customer.phone}</span>
              ) : null}
              {firstVisit ? <Badge>New</Badge> : <Badge variant="secondary">Returning</Badge>}
            </div>
            <span className="text-muted-foreground">
              {customer.visits} visit{customer.visits === 1 ? "" : "s"} · balance{" "}
              {money.format(customer.balance)}
              {customer.lastVisitOn ? ` · last ${shortDay(customer.lastVisitOn)}` : ""}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sale-patient-search">Search by name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sale-patient-search"
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                  placeholder="Type at least 2 letters"
                />
              </div>
              {matches.length > 0 ? (
                <ul className="divide-y rounded-lg border text-sm">
                  {matches.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        onClick={() => selectCustomer(match)}
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

            <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
              <span className="text-sm font-medium">Not in the list? Create the patient</span>
              <div className="grid items-end gap-2 sm:grid-cols-[1fr_10rem_auto]">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sale-new-name">Full name</Label>
                  <Input
                    id="sale-new-name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Ana Perez"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sale-new-phone">Phone</Label>
                  <Input
                    id="sale-new-phone"
                    value={newPhone}
                    onChange={(event) =>
                      setNewPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
                    }
                    placeholder="0999999999"
                    inputMode="numeric"
                  />
                </div>
                <Button type="button" variant="outline" onClick={onCreateNew} disabled={pending}>
                  <Plus data-icon="inline-start" />
                  Create and use
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Visit details */}
      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sale-date">Business day</Label>
          <Input
            id="sale-date"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </div>

        {firstVisit ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-source">How did they find the clinic?</Label>
            <SourcePicker sources={sources} value={sourceId} onChange={setSourceId} />
          </div>
        ) : null}

        {customer && appointments.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-appointment">Appointment (optional)</Label>
            <Select
              items={[
                { label: "Walk-in (no appointment)", value: "walk-in" },
                ...appointments.map((appointment) => ({
                  label: shortDay(appointment.scheduledOn),
                  value: appointment.id,
                })),
              ]}
              value={appointmentId || "walk-in"}
              onValueChange={(next) =>
                setAppointmentId(
                  (next as string | null) === "walk-in"
                    ? ""
                    : ((next as string | null) ?? "")
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="walk-in">Walk-in (no appointment)</SelectItem>
                {appointments.map((appointment) => (
                  <SelectItem key={appointment.id} value={appointment.id}>
                    {shortDay(appointment.scheduledOn)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </section>

      {/* Lines */}
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Lines</h3>
          <span className="text-sm tabular-nums text-muted-foreground">
            Total {money.format(saleTotal)}
          </span>
        </div>

        {lines.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li
                key={line.key}
                className="grid items-end gap-2 rounded-md border p-2 sm:grid-cols-[1fr_6rem_7rem_7rem_auto]"
              >
                {line.kind === "custom" ? (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={line.name}
                      onChange={(event) => updateLine(line.key, { name: event.target.value })}
                      placeholder="What was sold"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 self-center">
                    <span className="font-medium">{line.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {line.code} ·{" "}
                      {kindLabel({ kind: line.kind, unitType: line.unitType })}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    disabled={line.unitType === "package" || line.unitType === "membership"}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Unit price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                  />
                </div>

                <div className="flex h-8 items-center justify-end text-sm tabular-nums">
                  {money.format(lineTotal(line))}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(line.key)}
                    aria-label="Remove line"
                  >
                    <X />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No lines yet. Search the catalog below.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="sale-item-search">Add from the catalog</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                id="sale-item-search"
                value={itemQuery}
                onChange={(event) => {
                  setItemQuery(event.target.value)
                  setItemHighlight(0)
                }}
                onKeyDown={(event) => {
                  if (itemMatches.length === 0) return
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setItemHighlight((current) => (current + 1) % itemMatches.length)
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setItemHighlight(
                      (current) => (current - 1 + itemMatches.length) % itemMatches.length
                    )
                  } else if (event.key === "Enter") {
                    event.preventDefault()
                    addItem(itemMatches[itemHighlight] ?? itemMatches[0])
                  } else if (event.key === "Escape") {
                    setItemQuery("")
                  }
                }}
                role="combobox"
                aria-expanded={itemMatches.length > 0}
                aria-controls="sale-item-results"
                aria-autocomplete="list"
                aria-activedescendant={
                  itemMatches.length > 0 ? `sale-item-${itemHighlight}` : undefined
                }
                placeholder="Search treatment, product or service"
                className="pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Button type="button" variant="outline" onClick={addCustom}>
              Custom line
            </Button>
          </div>

          {itemMatches.length > 0 ? (
            <ul id="sale-item-results" role="listbox" className="divide-y rounded-lg border text-sm">
              {itemMatches.map((item, index) => (
                <li
                  key={item.itemId}
                  id={`sale-item-${index}`}
                  role="option"
                  aria-selected={index === itemHighlight}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setItemHighlight(index)}
                    onClick={() => addItem(item)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                      index === itemHighlight ? "bg-muted" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="shrink-0">
                        {kindLabel(item)}
                      </Badge>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.code}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {item.price > 0 ? money.format(item.price) : "No price"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : itemQuery.trim().length >= 2 ? (
            <p className="text-sm text-muted-foreground">No matching item.</p>
          ) : null}
        </div>
      </section>

      {/* Payment */}
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Payment</h3>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={selectFullPayment}
            className={`h-9 rounded-md text-sm font-medium transition-colors ${
              paymentMode === "full"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Paid in full
          </button>
          <button
            type="button"
            onClick={selectPlanPayment}
            className={`h-9 rounded-md text-sm font-medium transition-colors ${
              paymentMode === "plan"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Partial or installments
          </button>
        </div>

        {paymentMode === "full" ? (
          <div className="flex w-64 flex-col gap-2">
            <Label htmlFor="sale-full-method">How did the patient pay?</Label>
            <MethodSelect
              id="sale-full-method"
              methods={methods}
              value={paidMethodId}
              onValueChange={setPaidMethodId}
              placeholder="Choose a method"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Records the sale as paid in full for {money.format(saleTotal)}.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Amount paid today</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidToday}
                  onChange={(event) => setPaidToday(event.target.value)}
                  className="w-40 text-right tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Method</Label>
                <MethodSelect
                  methods={methods}
                  value={paidMethodId}
                  onValueChange={setPaidMethodId}
                  className="w-56"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span>
                Balance due{" "}
                <span className="font-medium">
                  {money.format(Math.max(0, scheduleGap))}
                </span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addInstallment}>
                <Plus data-icon="inline-start" />
                Add installment
              </Button>
            </div>

            {installments.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {installments.map((item) => (
                  <li
                    key={item.key}
                    className="grid items-end gap-2 rounded-md border p-2 sm:grid-cols-[1fr_9rem_7rem_auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Method</Label>
                      <MethodSelect
                        methods={methods}
                        value={item.methodId}
                        onValueChange={(value) =>
                          updateInstallment(item.key, { methodId: value })
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Due</Label>
                      <Input
                        type="date"
                        value={item.dueOn}
                        onChange={(event) =>
                          updateInstallment(item.key, { dueOn: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) =>
                          updateInstallment(item.key, { amount: event.target.value })
                        }
                        className="text-right tabular-nums"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInstallment(item.key)}
                        aria-label="Remove installment"
                      >
                        <X />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No installments yet. Use “Add installment” to schedule the remaining
                amount.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm tabular-nums">
              <span className="text-muted-foreground">
                Paid today{" "}
                <span className="font-medium text-foreground">
                  {money.format(paidTodayValue)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Balance due{" "}
                <span className="font-medium text-foreground">
                  {money.format(remaining)}
                </span>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <Label htmlFor="sale-notes">Notes (optional)</Label>
        <textarea
          id="sale-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Sale total</span>
          <span className="text-lg font-semibold tabular-nums">{money.format(saleTotal)}</span>
        </div>
        <div className="flex items-center gap-3">
          {paymentMode === "plan" && Math.abs(scheduleGap) > 0.005 ? (
            <span className="text-sm text-destructive">
              {scheduleGap > 0
                ? `${money.format(scheduleGap)} still to schedule`
                : `Over-scheduled by ${money.format(-scheduleGap)}`}
            </span>
          ) : null}
          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Recording…" : "Record sale"}
          </Button>
        </div>
      </div>

      {outcome.kind === "saved" ? (
        <div className="flex items-start gap-2 rounded-lg border p-4 text-sm">
          <CheckCircle2 className="mt-0.5 text-primary" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              Sale recorded for {money.format(outcome.total)}.
            </span>
            <span className="flex flex-wrap gap-x-3 text-muted-foreground">
              <Link href="/sales/details" className="underline-offset-4 hover:underline">
                Open sales details
              </Link>
              <Link href="/sales/new" className="underline-offset-4 hover:underline">
                Log another sale
              </Link>
            </span>
          </div>
        </div>
      ) : null}
    </form>
  )
}
