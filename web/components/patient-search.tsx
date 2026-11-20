"use client"

import { Search } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function PatientSearch({
  defaultValue,
  hidden,
  placeholder = "Search by patient",
}: {
  defaultValue?: string
  hidden?: Record<string, string>
  placeholder?: string
}) {
  const pathname = usePathname()

  return (
    <form action={pathname} className="flex w-full max-w-sm items-center gap-2">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Input
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="submit" variant="outline">
        <Search data-icon="inline-start" />
        Search
      </Button>
    </form>
  )
}
