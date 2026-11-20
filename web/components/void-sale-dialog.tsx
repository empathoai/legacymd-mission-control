"use client"

import { Ban } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { voidSaleAction } from "@/app/(app)/sales/returns/actions"
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
import type { SaleDocument } from "@/lib/returns"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function VoidSaleDialog({ sale }: { sale: SaleDocument }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await voidSaleAction(sale.saleId, reason)
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
        <Ban data-icon="inline-start" />
        Void
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void the sale</DialogTitle>
            <DialogDescription>
              {sale.customerName} · {money.format(sale.total)} sold, nothing collected. It was
              entered by mistake and never happened.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="void-sale-reason">Reason</Label>
            <Input
              id="void-sale-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Wrong patient, entered twice, …"
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={save} disabled={pending}>
              {pending ? "Voiding…" : "Void the sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
