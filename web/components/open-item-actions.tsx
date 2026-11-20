"use client"

import { Ban, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { cancelInstallment, recordPayment } from "@/app/(app)/open-items/actions"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { clinicToday } from "@/lib/dates"
import type { OpenItem } from "@/lib/open-items"
import type { MethodOption } from "@/lib/sale-entry"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

type Mode = "payment" | "cancel" | null

export function OpenItemActions({
  installment,
  methods,
}: {
  installment: OpenItem
  methods: MethodOption[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [amount, setAmount] = useState(String(installment.remaining))
  const [on, setOn] = useState(clinicToday())
  const [methodId, setMethodId] = useState(
    () => methods.find((method) => method.slug === "cash")?.id ?? methods[0]?.id ?? ""
  )
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function open(next: Exclude<Mode, null>) {
    setMode(next)
    setAmount(String(installment.remaining))
    setOn(clinicToday())
    setNote("")
    setReason("")
    setError(null)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result =
        mode === "cancel"
          ? await cancelInstallment(installment.id, reason)
          : await recordPayment({
              installmentId: installment.id,
              amount: Number(amount),
              on,
              methodId,
              note: note.trim() || null,
            })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setMode(null)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="outline" size="xs" onClick={() => open("payment")}>
        <Check data-icon="inline-start" />
        Record payment
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        title="Cancel this installment"
        aria-label={`Cancel the installment of ${installment.customerName}`}
        onClick={() => open("cancel")}
      >
        <Ban />
      </Button>

      <Dialog
        open={mode !== null}
        onOpenChange={(next) => {
          if (!next) {
            setMode(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "cancel" ? "Cancel the installment" : "Record a payment"}
            </DialogTitle>
            <DialogDescription>
              {mode === "cancel"
                ? `${installment.customerName}, ${money.format(installment.remaining)} due on ${installment.dueOn}. It stops being expected; the reason stays in the record.`
                : `${installment.customerName} owes ${money.format(installment.remaining)} on ${installment.dueOn}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {mode === "cancel" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="cancel-installment-reason">Reason</Label>
                <Input
                  id="cancel-installment-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="The plan changed, the treatment was cancelled, …"
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payment-amount">
                      Amount (max {money.format(installment.remaining)})
                    </Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      max={installment.remaining}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payment-on">Day</Label>
                    <Input
                      id="payment-on"
                      type="date"
                      value={on}
                      max={clinicToday()}
                      onChange={(event) => setOn(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-method">Method</Label>
                  <Select
                    items={methods.map((method) => ({ label: method.label, value: method.id }))}
                    value={methodId || null}
                    onValueChange={(next) => setMethodId((next as string | null) ?? "")}
                  >
                    <SelectTrigger id="payment-method" className="w-full">
                      <SelectValue placeholder="Pick the method" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {methods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-note">Note (optional)</Label>
                  <Input
                    id="payment-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Partial payment, second sitting, …"
                  />
                </div>
              </>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              variant={mode === "cancel" ? "destructive" : "default"}
              onClick={save}
              disabled={pending}
            >
              {pending ? "Saving…" : mode === "cancel" ? "Cancel the installment" : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
