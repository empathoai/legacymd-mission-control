"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"

import { createCatalogItem, type CatalogKind } from "@/app/(app)/catalog/actions"
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

const nouns: Record<string, string> = {
  treatment: "treatment",
  package: "package",
  membership: "membership",
  product: "product",
  service: "service",
}

export function CatalogCreateDialog({
  kind,
  unitType,
}: {
  kind: CatalogKind
  unitType?: "unit" | "package" | "membership"
}) {
  const noun =
    unitType === "package" || unitType === "membership" ? unitType : kind
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [cost, setCost] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setName("")
      setPrice("")
      setCost("")
      setDescription("")
      setError(null)
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (name.trim().length < 2) {
      setError("A name of at least 2 characters is required.")
      return
    }
    if (price.trim() === "") {
      setError("A price is required.")
      return
    }

    const parsed = Number(price)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Price must be zero or more.")
      return
    }

    let parsedCost: number | null = null
    if (cost.trim() !== "") {
      parsedCost = Number(cost)
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        setError("Cost must be zero or more.")
        return
      }
    }

    startTransition(async () => {
      const result = await createCatalogItem({
        kind,
        unitType,
        name,
        price: parsed,
        cost: parsedCost,
        description: kind === "treatment" ? description : null,
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
      <Button onClick={() => onOpenChange(true)}>
        <Plus data-icon="inline-start" />
        New {noun}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New {noun}</DialogTitle>
              <DialogDescription>
                The code is assigned automatically and the price applies from today.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-item-name">Name</Label>
                <Input
                  id="new-item-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new-item-price">List price</Label>
                <Input
                  id="new-item-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new-item-cost">Cost today (optional)</Label>
                <Input
                  id="new-item-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  What the clinic pays for it. Leave it empty if unknown; it can be set later.
                </p>
              </div>

              {kind === "treatment" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-item-description">
                    {unitType === "package" ? "Sessions included" : "Description (optional)"}
                  </Label>
                  <Input
                    id="new-item-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
