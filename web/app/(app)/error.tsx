"use client"

import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

/**
 * One error boundary for the whole app shell. It says what happened in the
 * owner's words, keeps the numbers safe, and offers the two ways out.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-lg border p-6">
      <h2 className="text-lg font-medium">This screen could not load</h2>
      <p className="text-sm text-muted-foreground">
        Nothing was saved or changed. Try again, and if it repeats, open another
        screen and come back.
      </p>
      {error.message ? (
        <p className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
          Back to the dashboard
        </Button>
      </div>
    </div>
  )
}
