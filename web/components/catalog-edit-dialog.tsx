"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"

import { saveCatalogItem, type CatalogKind } from "@/app/(app)/catalog/actions"
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
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function CatalogEditDialog({
  kind,
  itemId,
  code,
  name,
  price,
  cost,
  nextPrice,
  nextPriceFrom,
  active,
}: {
  kind: CatalogKind
  itemId: string
  code: string
  name: string
  price: number | null
  cost: number | null
  nextPrice: number | null
  nextPriceFrom: string | null
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const [priceValue, setPriceValue] = useState(price === null ? "" : String(price))
  const [priceDirty, setPriceDirty] = useState(false)
  const [costValue, setCostValue] = useState(cost === null ? "" : String(cost))
  const [costDirty, setCostDirty] = useState(false)
  const [appliesFrom, setAppliesFrom] = useState<"today" | "tomorrow">("today")
  const [isActive, setIsActive] = useState(active)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setPriceValue(price === null ? "" : String(price))
    setPriceDirty(false)
    setCostValue(cost === null ? "" : String(cost))
    setCostDirty(false)
    setAppliesFrom("today")
    setIsActive(active)
    setError(null)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) reset()
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (priceValue.trim() === "") {
      setError("A price is required.")
      return
    }

    const parsed = Number(priceValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Price must be zero or more.")
      return
    }

    let parsedCost: number | null = null
    if (costDirty) {
      if (costValue.trim() === "") {
        setError("A cost is required when you change it.")
        return
      }
      parsedCost = Number(costValue)
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        setError("Cost must be zero or more.")
        return
      }
    }

    startTransition(async () => {
      const result = await saveCatalogItem({
        kind,
        itemId,
        price: parsed,
        priceDirty,
        appliesFrom,
        active: isActive,
        cost: parsedCost,
        costDirty,
      })

      if (result.ok) {
        setOpen(false)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${code}`}
        onClick={() => onOpenChange(true)}
      >
        <Pencil />
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Edit {code}</DialogTitle>
              <DialogDescription>{name}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`price-${itemId}`}>List price</Label>
                <Input
                  id={`price-${itemId}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={priceValue}
                  onChange={(event) => {
                    setPriceValue(event.target.value)
                    setPriceDirty(true)
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`cost-${itemId}`}>Cost today</Label>
                <Input
                  id={`cost-${itemId}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={costValue}
                  onChange={(event) => {
                    setCostValue(event.target.value)
                    setCostDirty(true)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  What the clinic pays for it. Changing it closes the previous cost on the
                  chosen date.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Applies from</Label>
                <ToggleGroup
                  value={[appliesFrom]}
                  onValueChange={(value) => {
                    const next = value[0]
                    if (next === "today" || next === "tomorrow") setAppliesFrom(next)
                  }}
                >
                  <ToggleGroupItem value="today">Today</ToggleGroupItem>
                  <ToggleGroupItem value="tomorrow">Tomorrow</ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                  A change from tomorrow leaves today&apos;s price and cost untouched.
                </p>
                {nextPrice !== null && nextPriceFrom ? (
                  <p className="text-xs text-muted-foreground">
                    Scheduled: {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(nextPrice)}{" "}
                    from{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                    }).format(new Date(`${nextPriceFrom}T12:00:00`))}
                    .
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`active-${itemId}`}>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    An inactive item cannot be sold.
                  </p>
                </div>
                <Switch
                  id={`active-${itemId}`}
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked)}
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
