"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { recordReturn } from "@/app/(app)/sales/returns/actions"
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
import type { MethodOption } from "@/lib/sale-entry"
import type { SaleDocument } from "@/lib/returns"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function ReturnSaleDialog({
  sale,
  methods,
}: {
  sale: SaleDocument
  methods: MethodOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(sale.remaining))
  const [on, setOn] = useState(clinicToday())
  const [methodId, setMethodId] = useState(
    () => methods.find((method) => method.slug === "credit")?.id ?? methods[0]?.id ?? ""
  )
  const [kind, setKind] = useState<"refund" | "chargeback">("refund")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await recordReturn({
        saleId: sale.saleId,
        amount: Number(amount),
        methodId,
        on,
        kind,
        reason,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
        <RotateCcw data-icon="inline-start" />
        Return
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return money</DialogTitle>
            <DialogDescription>
              {sale.customerName} · {money.format(sale.collected)} collected on{" "}
              {sale.occurredOn}. The sale stays; the money goes back.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="return-amount">
                  Amount (max {money.format(sale.remaining)})
                </Label>
                <Input
                  id="return-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  max={sale.remaining}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="return-on">Day</Label>
                <Input
                  id="return-on"
                  type="date"
                  value={on}
                  max={clinicToday()}
                  onChange={(event) => setOn(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="return-method">Method</Label>
                <Select
                  items={methods.map((method) => ({ label: method.label, value: method.id }))}
                  value={methodId || null}
                  onValueChange={(next) => setMethodId((next as string | null) ?? "")}
                >
                  <SelectTrigger id="return-method" className="w-full">
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
                <Label htmlFor="return-kind">Kind</Label>
                <Select
                  items={[
                    { label: "Refund", value: "refund" },
                    { label: "Chargeback", value: "chargeback" },
                  ]}
                  value={kind}
                  onValueChange={(next) => setKind((next as "refund" | "chargeback") ?? "refund")}
                >
                  <SelectTrigger id="return-kind" className="w-full">
                    <SelectValue placeholder="Refund" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="chargeback">Chargeback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="return-reason">Reason</Label>
              <Input
                id="return-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="The treatment was cancelled, the card was charged twice, …"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
