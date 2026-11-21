"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Ban,
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Receipt,
  Settings,
  TrendingUp,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

import { signOut } from "@/app/actions/auth"
import { BrandMark } from "@/components/brand-mark"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const groups = [
  {
    label: "Clinic",
    items: [
      { title: "Patients", href: "/patients/report", icon: Users },
      { title: "New patient", href: "/patients/new", icon: UserPlus },
    ],
  },
  {
    label: "Billing",
    items: [
      { title: "Sales", href: "/sales/details", icon: Receipt },
      { title: "Open items", href: "/open-items", icon: CalendarClock },
      { title: "Returns", href: "/sales/returns", icon: Undo2 },
      { title: "Voids", href: "/sales/voids", icon: Ban },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Executive reports", href: "/reports", icon: TrendingUp },
      { title: "Sales report", href: "/sales/report", icon: BarChart3 },
      { title: "Expenses", href: "/expenses", icon: Wallet },
    ],
  },
]

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  if (href === "/catalog") return pathname.startsWith("/catalog")
  if (href === "/expenses") return pathname === "/expenses" || pathname.startsWith("/expenses/")
  if (href === "/patients/report") {
    return (
      pathname === "/patients/report" ||
      (pathname.startsWith("/patients/") && pathname !== "/patients/new")
    )
  }
  return pathname === href
}

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="LegacyMD Mission Control"
              className="group-data-[collapsible=icon]:p-0!"
              render={<Link href="/" />}
            >
              <BrandMark className="size-8 shrink-0 rounded-md" />
              <span className="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">LegacyMD</span>
                <span className="truncate text-xs text-muted-foreground">
                  Mission Control
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pb-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="New sale"
                  isActive={pathname === "/sales/new"}
                  className="bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"
                  render={<Link href="/sales/new" />}
                >
                  <PlusCircle />
                  <span className="font-medium">New sale</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Dashboard"
                  isActive={pathname === "/"}
                  className={
                    pathname === "/"
                      ? "relative before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary group-data-[collapsible=icon]:before:hidden"
                      : undefined
                  }
                  render={<Link href="/" />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={active}
                        className={
                          active
                            ? "relative before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary group-data-[collapsible=icon]:before:hidden"
                            : undefined
                        }
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Catalog"
              isActive={isItemActive(pathname, "/catalog")}
              className={
                isItemActive(pathname, "/catalog")
                  ? "relative before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary group-data-[collapsible=icon]:before:hidden"
                  : undefined
              }
              render={<Link href="/catalog" />}
            >
              <Package />
              <span>Catalog</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={pathname === "/settings"}
              className={
                pathname === "/settings"
                  ? "relative before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary group-data-[collapsible=icon]:before:hidden"
                  : undefined
              }
              render={<Link href="/settings" />}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <UserRound className="size-4 shrink-0" aria-hidden />
              <span className="truncate text-xs group-data-[collapsible=icon]:hidden">
                {email}
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit" tooltip="Sign out" className="w-full">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
