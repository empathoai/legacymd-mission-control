"use client"

import { Check, Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import {
  createExpenseItem,
  setExpenseEntry,
  type ActionResult,
} from "@/app/(app)/expenses/actions"
import { Badge } from "@/components/ui/badge"
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
  ExpenseCostBehavior,
  ExpenseItemOption,
  ExpenseLine,
  SupplierOption,
} from "@/lib/expenses"

// The label the owner reads for each kind of cost. The value is the database's
// cost_behavior; nothing here matches on the concept name.
const COST_BEHAVIOR_LABELS: Record<ExpenseCostBehavior, string> = {
  fixed: "Fixed",
  variable: "Variable",
  acquisition: "Acquisition",
  owner_draw: "Owner draw",
  capex: "One-time / CapEx",
}

const COST_BEHAVIOR_OPTIONS = (
  Object.keys(COST_BEHAVIOR_LABELS) as ExpenseCostBehavior[]
).map((value) => ({ value, label: COST_BEHAVIOR_LABELS[value] }))

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
  const [supplierId, setSupplierId] = useState(entry?.supplierId ?? "")
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "")
  const [note, setNote] = useState(entry?.note ?? "")
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategoryId, setNewCategoryId] = useState("")
  const [newCostBehavior, setNewCostBehavior] =
    useState<ExpenseCostBehavior>("fixed")
  const [newGuidance, setNewGuidance] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selected = list.find((option) => option.id === itemId) ?? null

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
    setSupplierId(entry?.supplierId ?? "")
    setAmount(entry ? String(entry.amount) : "")
    setNote(entry?.note ?? "")
    setAdding(false)
    setNewName("")
    setNewCategoryId("")
    setNewCostBehavior("fixed")
    setNewGuidance("")
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
        costBehavior: newCostBehavior,
        guidance: newGuidance.trim() || null,
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
      setNewCostBehavior("fixed")
      setNewGuidance("")
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

              {selected && !adding ? (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">
                      {COST_BEHAVIOR_LABELS[selected.costBehavior]}
                    </Badge>
                    <Badge variant="secondary">{selected.categoryLabel}</Badge>
                  </div>
                  {selected.guidance ? (
                    <p className="text-xs text-muted-foreground">{selected.guidance}</p>
                  ) : null}
                </div>
              ) : null}

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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      items={categories.map((option) => ({
                        label: option.label,
                        value: option.id,
                      }))}
                      value={newCategoryId || null}
                      onValueChange={(next) => setNewCategoryId((next as string | null) ?? "")}
                    >
                      <SelectTrigger className="w-full" aria-label="Category">
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
                    <Select
                      items={COST_BEHAVIOR_OPTIONS}
                      value={newCostBehavior}
                      onValueChange={(next) =>
                        setNewCostBehavior(
                          (next as ExpenseCostBehavior | null) ?? "fixed"
                        )
                      }
                    >
                      <SelectTrigger className="w-full" aria-label="Cost type">
                        <SelectValue placeholder="Cost type" />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {COST_BEHAVIOR_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={newGuidance}
                    onChange={(event) => setNewGuidance(event.target.value)}
                    placeholder="Guidance (optional): what to record here, what not to"
                    aria-label="Guidance"
                  />
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
