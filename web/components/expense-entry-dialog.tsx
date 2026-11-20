"use client"

import { Check, Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import {
  createExpenseItem,
  setExpenseEntry,
  type ActionResult,
} from "@/app/(app)/expenses/actions"
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
import type {
  ExpenseCategoryOption,
  ExpenseItemOption,
  ExpenseLine,
  SupplierOption,
} from "@/lib/expenses"

export function ExpenseEntryDialog({
  periodId,
  period,
  items,
  suppliers,
  categories,
  entry,
  lines,
  disabled,
}: {
  periodId: string
  period: string
  items: ExpenseItemOption[]
  suppliers: SupplierOption[]
  categories: ExpenseCategoryOption[]
  entry?: ExpenseLine
  lines: ExpenseLine[]
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(items)
  const [itemId, setItemId] = useState(entry?.itemId ?? "")
  const [supplierId, setSupplierId] = useState("")
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "")
  const [note, setNote] = useState(entry?.note ?? "")
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategoryId, setNewCategoryId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setList(items)
  }, [items])

  // The month is a sheet: one line per item and supplier. Picking a pair that already
  // has a line loads it instead of silently overwriting it on save.
  useEffect(() => {
    if (!itemId) {
      setNotice(null)
      return
    }

    const match = lines.find(
      (line) =>
        !line.voided &&
        line.itemId === itemId &&
        (line.supplierId ?? null) === (supplierId || null)
    )

    if (!match) {
      setNotice(null)
      return
    }

    setAmount(String(match.amount))
    setNote(match.note ?? "")
    setNotice(
      match.id === entry?.id
        ? null
        : `This month already has $${match.amount.toFixed(2)} for ${match.itemName}. Saving replaces that line.`
    )
  }, [itemId, supplierId, lines, entry?.id])

  function reset(next: boolean) {
    setOpen(next)
    if (!next) return
    setItemId(entry?.itemId ?? "")
    setSupplierId("")
    setAmount(entry ? String(entry.amount) : "")
    setNote(entry?.note ?? "")
    setAdding(false)
    setNewName("")
    setNewCategoryId("")
    setError(null)
  }

  function save() {
    setError(null)
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("An amount of zero or more is required.")
      return
    }

    startTransition(async () => {
      const result: ActionResult = await setExpenseEntry({
        periodId,
        period,
        itemId,
        supplierId: supplierId || null,
        amount: parsed,
        note: note.trim() || null,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  function addItem() {
    setError(null)
    const category = categories.find((option) => option.id === newCategoryId)

    startTransition(async () => {
      const result = await createExpenseItem({
        name: newName,
        categoryId: newCategoryId,
        categoryLabel: category?.label ?? "—",
        period,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setList((prev) => [...prev, result.item])
      setItemId(result.item.id)
      setNewName("")
      setNewCategoryId("")
      setAdding(false)
      router.refresh()
    })
  }

  return (
    <>
      {entry ? (
        <Button
          variant="ghost"
          size="icon-xs"
          title="Edit the line"
          aria-label={`Edit ${entry.itemName}`}
          disabled={disabled}
          onClick={() => reset(true)}
        >
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => reset(true)} disabled={disabled}>
          <Plus data-icon="inline-start" />
          Add expense
        </Button>
      )}

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{entry ? "Edit the line" : "Add an expense"}</DialogTitle>
            <DialogDescription>
              One line per expense and supplier in the month. The amount can be zero.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-item">Expense</Label>
              <Select
                items={list.map((option) => ({
                  label: `${option.name} · ${option.categoryLabel}`,
                  value: option.id,
                }))}
                value={itemId || null}
                onValueChange={(next) => setItemId((next as string | null) ?? "")}
              >
                <SelectTrigger id="expense-item" className="w-full">
                  <SelectValue placeholder="Pick the expense" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {list.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} · {option.categoryLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {adding ? (
                <div className="flex flex-col gap-2 rounded-md border border-dashed p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="New expense, e.g. Malpractice insurance"
                      autoFocus
                    />
                    <Button type="button" size="sm" onClick={addItem} disabled={pending}>
                      Add
                    </Button>
                  </div>
                  <Select
                    items={categories.map((option) => ({
                      label: option.label,
                      value: option.id,
                    }))}
                    value={newCategoryId || null}
                    onValueChange={(next) => setNewCategoryId((next as string | null) ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {categories.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  + New expense
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="expense-supplier">Supplier (optional)</Label>
                <Select
                  items={suppliers.map((option) => ({
                    label: option.name,
                    value: option.id,
                  }))}
                  value={supplierId || null}
                  onValueChange={(next) => setSupplierId((next as string | null) ?? "")}
                >
                  <SelectTrigger id="expense-supplier" className="w-full">
                    <SelectValue placeholder="No supplier" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {suppliers.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="expense-amount">Amount</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-note">Note (optional)</Label>
              <Input
                id="expense-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Invoice number, what it covers, …"
              />
            </div>

            {notice ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {notice}
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              <Check data-icon="inline-start" />
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
