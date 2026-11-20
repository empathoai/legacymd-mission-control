"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/sales": "Sales",
  "/sales/new": "New sale",
  "/sales/details": "Sales details",
  "/sales/returns": "Returns",
  "/sales/voids": "Voids",
  "/open-items": "Open Items",
  "/sales/report": "Sales report",
  "/appointments": "Appointments",
  "/patients/new": "New patient",
  "/patients/report": "Patient report",
  "/expenses": "Expenses",
  "/catalog": "Catalog",
  "/reports": "Reports",
  "/settings": "Settings",
}

export function SiteHeader() {
  const pathname = usePathname()
  const title =
    titles[pathname] ??
    (pathname.startsWith("/catalog")
      ? "Catalog"
      : pathname.startsWith("/expenses/")
        ? "Expenses"
        : pathname.startsWith("/patients/")
          ? "Patient"
          : "LegacyMD")

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-auto" />
      <span className="truncate text-sm font-medium">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}
