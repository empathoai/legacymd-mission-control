import Link from "next/link"

import { Button } from "@/components/ui/button"

/**
 * Inside the app shell: a mistyped link or a missing month lands here, in the
 * owner's words, with a way back. The plain Next.js 404 stays outside.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-lg border p-6">
      <h2 className="text-lg font-medium">That page does not exist</h2>
      <p className="text-sm text-muted-foreground">
        The address may have a typo, or the record was removed. Everything else is
        where you left it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Back to the dashboard
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/expenses" />}
        >
          Expenses
        </Button>
      </div>
    </div>
  )
}
