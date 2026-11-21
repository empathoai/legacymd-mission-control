import type { ReactNode } from "react"

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  action,
  footer,
  valueClassName,
}: {
  label: string
  value: ReactNode
  action?: ReactNode
  footer?: ReactNode
  valueClassName?: string
}) {
  return (
    <Card>
      <CardHeader className="gap-x-3">
        <CardDescription className="truncate">{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            valueClassName
          )}
        >
          {value}
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      {footer ? (
        <CardFooter className="mt-auto text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5 truncate">
            {footer}
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}
