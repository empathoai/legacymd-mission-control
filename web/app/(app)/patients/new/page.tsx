import Link from "next/link"
import { Search } from "lucide-react"

import { PatientForm } from "@/components/patient-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { listCustomers } from "@/lib/customers"

export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatDay(value: string | null) {
  return value ? day.format(new Date(`${value}T12:00:00`)) : "—"
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim() : ""
  const matches = q ? (await listCustomers(q)).slice(0, 5) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New patient</h1>
        <p className="text-sm text-muted-foreground">
          Search first. A duplicate hides their history and splits their money.
        </p>
      </div>

      <form action="/patients/new" className="flex w-full max-w-lg items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name"
          className="flex-1"
        />
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Search
        </Button>
      </form>

      {q ? (
        matches.length > 0 ? (
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {matches.length === 1
                ? "One patient matches."
                : `${matches.length} patients match.`}{" "}
              If it is them, open the report instead of creating a second one.
            </p>
            <ul className="divide-y rounded-lg border text-sm">
              {matches.map((match) => (
                <li
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{match.fullName}</span>
                    <span className="text-muted-foreground">
                      {match.phone ?? "no phone"} · spent {money.format(match.spentTotal)} ·
                      last visit {formatDay(match.lastVisitOn)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/patients/report?q=${encodeURIComponent(match.fullName)}`}
                      />
                    }
                  >
                    Open in report
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No patient matches. Create them below.
          </p>
        )
      ) : null}

      <Separator />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Or create a new patient</h2>
        <p className="text-sm text-muted-foreground">
          Only if the search above found nobody.
        </p>
      </div>

      <PatientForm />
    </div>
  )
}
