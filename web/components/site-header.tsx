"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/sales": "Sales",
  "/sales/new": "New sale",
  "/sales/details": "Sales details",
  "/sales/returns": "Returns",
  "/sales/voids": "Voids",
  "/open-items": "Open items",
  "/sales/report": "Sales report",
  "/patients/new": "New patient",
  "/patients/report": "Patients",
  "/expenses": "Expenses",
  "/catalog": "Catalog",
  "/reports": "Executive reports",
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
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <span className="truncate text-sm font-medium">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        {pathname !== "/sales/new" ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/sales/new" />}
          >
            <Plus data-icon="inline-start" />
            New sale
          </Button>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  )
}
