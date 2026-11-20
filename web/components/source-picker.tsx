"use client"

import { Plus } from "lucide-react"
import { useState, useTransition } from "react"

import { createSource, type SourceOption } from "@/app/actions/sources"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * The channel select, plus a way to add one without leaving the screen. The
 * input opens inline instead of in a dialog: the sale form and the booking
 * dialog are already focused places, and a second overlay inside them is noise.
 */
export function SourcePicker({
  sources,
  value,
  onChange,
  id,
  placeholder = "Select a channel",
}: {
  sources: SourceOption[]
  value: string
  onChange: (next: string) => void
  id?: string
  placeholder?: string
}) {
  const [list, setList] = useState(sources)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await createSource(label)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setList((prev) =>
        prev.some((source) => source.id === result.source.id)
          ? prev
          : [...prev, result.source]
      )
      onChange(result.source.id)
      setLabel("")
      setAdding(false)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          items={list.map((source) => ({ label: source.label, value: source.id }))}
          value={value || null}
          onValueChange={(next) => onChange((next as string | null) ?? "")}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {list.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Add a channel"
          aria-label="Add a channel"
          onClick={() => {
            setAdding((open) => !open)
            setError(null)
          }}
        >
          <Plus />
        </Button>
      </div>

      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-2">
          <div className="flex items-center gap-2">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="New channel, e.g. TikTok"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  save()
                }
                if (event.key === "Escape") setAdding(false)
              }}
            />
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
