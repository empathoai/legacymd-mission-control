"use client"

import { Ban } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { voidExpenseEntry } from "@/app/(app)/expenses/actions"
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

export function ExpenseVoidDialog({
  id,
  period,
  itemName,
  disabled,
}: {
  id: string
  period: string
  itemName: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function voidLine() {
    setError(null)
    startTransition(async () => {
      const result = await voidExpenseEntry(id, period, reason)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setReason("")
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Void the line"
        aria-label={`Void ${itemName}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Ban />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setReason("")
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void the line</DialogTitle>
            <DialogDescription>
              {itemName} stops counting in the month, but the row stays for the record.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="void-expense-reason">Reason</Label>
            <Input
              id="void-expense-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Wrong amount, duplicated invoice, …"
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={voidLine} disabled={pending}>
              {pending ? "Voiding…" : "Void the line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
