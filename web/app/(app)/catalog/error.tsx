"use client"

import { Button } from "@/components/ui/button"

export default function CatalogError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
      <h3 className="text-lg font-medium">The catalog could not be read</h3>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
