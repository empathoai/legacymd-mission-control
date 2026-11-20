"use client"

import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { settleReturnAction } from "@/app/(app)/sales/returns/actions"
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
import { clinicToday } from "@/lib/dates"

export function SettleReturnDialog({
  id,
  amount,
  customerName,
}: {
  id: string
  amount: number
  customerName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [on, setOn] = useState(clinicToday())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function settle() {
    setError(null)
    startTransition(async () => {
      const result = await settleReturnAction(id, on)
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
      <Button
        variant="outline"
        size="icon-xs"
        title="Mark refunded"
        aria-label={`Mark refunded: ${customerName}`}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark the return as paid</DialogTitle>
            <DialogDescription>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(amount)}{" "}
              back to {customerName}. Only the state moves; the amount and the method stay.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="settle-on">Day the money left</Label>
            <Input
              id="settle-on"
              type="date"
              value={on}
              max={clinicToday()}
              onChange={(event) => setOn(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={settle} disabled={pending}>
              {pending ? "Saving…" : "Mark refunded"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
