"use client"

import { Search } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CatalogSearch({ defaultValue }: { defaultValue?: string }) {
  const pathname = usePathname()

  return (
    <form action={pathname} className="flex w-full max-w-sm items-center gap-2">
      <Input
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder="Search by name or code"
        className="flex-1"
      />
      <Button type="submit" variant="outline">
        <Search data-icon="inline-start" />
        Search
      </Button>
    </form>
  )
}
