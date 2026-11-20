"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Ban,
  CalendarDays,
  ChartLine,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  Receipt,
  Settings,
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
} from "@/components/ui/sidebar"

const groups = [
  {
    label: "Operations",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Appointments", href: "/appointments", icon: CalendarDays },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "New sale", href: "/sales/new", icon: Plus },
      { title: "Sales details", href: "/sales/details", icon: Receipt },
      { title: "Open Items", href: "/open-items", icon: Wallet },
      { title: "Returns", href: "/sales/returns", icon: Undo2 },
      { title: "Voids", href: "/sales/voids", icon: Ban },
      { title: "Sales report", href: "/sales/report", icon: ChartLine },
    ],
  },
  {
    label: "Patients",
    items: [
      { title: "New patient", href: "/patients/new", icon: UserPlus },
      { title: "Patient report", href: "/patients/report", icon: Users },
    ],
  },
  {
    label: "Catalogs",
    items: [{ title: "Catalog", href: "/catalog", icon: Package }],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", href: "/reports", icon: ChartLine },
      { title: "Expenses", href: "/expenses", icon: Wallet },
    ],
  },
]

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
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={
                        item.href === "/catalog"
                          ? pathname.startsWith("/catalog")
                          : pathname === item.href
                      }
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
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
            <SidebarMenuButton
              tooltip="Settings"
              isActive={pathname === "/settings"}
              render={<Link href="/settings" />}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
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
