import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        That page does not exist
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Check the address, or open the dashboard and start from there.
      </p>
      <Link
        href="/"
        className="text-sm underline underline-offset-4 hover:text-foreground"
      >
        Back to the dashboard
      </Link>
    </main>
  )
}
