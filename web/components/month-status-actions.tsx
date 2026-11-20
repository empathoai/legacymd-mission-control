"use client"

import { Lock, LockOpen } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { closeExpenseMonth, reopenExpenseMonth } from "@/app/(app)/expenses/actions"
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
import type { ExpenseMonthStatus } from "@/lib/expenses"

export function MonthStatusActions({
  id,
  period,
  status,
  total,
}: {
  id: string
  period: string
  status: ExpenseMonthStatus
  total: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const closing = status === "open"

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = closing
        ? await closeExpenseMonth(id, period)
        : await reopenExpenseMonth(id, period, reason)

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
      <Button variant={closing ? "default" : "outline"} onClick={() => setOpen(true)}>
        {closing ? (
          <Lock data-icon="inline-start" />
        ) : (
          <LockOpen data-icon="inline-start" />
        )}
        {closing ? "Close month" : "Reopen month"}
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
            <DialogTitle>{closing ? "Close the month" : "Reopen the month"}</DialogTitle>
            <DialogDescription>
              {closing
                ? `The month stores its total (${new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(total)}) and refuses every edit until it is reopened.`
                : "The total is cleared and the month accepts edits again. The reason stays in the record."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            {closing ? (
              <p className="text-sm text-muted-foreground">
                A late invoice can reopen it later.
              </p>
            ) : (
              <>
                <Label htmlFor="reopen-reason">Reason</Label>
                <Input
                  id="reopen-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="A late invoice arrived, …"
                  autoFocus
                />
              </>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : closing ? "Close the month" : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
