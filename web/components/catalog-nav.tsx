"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const items = [
  { title: "Treatments", href: "/catalog/treatments" },
  { title: "Packages", href: "/catalog/packages" },
  { title: "Memberships", href: "/catalog/memberships" },
  { title: "Products", href: "/catalog/products" },
  { title: "Services", href: "/catalog/services" },
]

export function CatalogNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
