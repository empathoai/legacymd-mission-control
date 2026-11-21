import { Badge } from "@/components/ui/badge"
import type { SaleStatus } from "@/lib/sales"

const LABEL: Record<SaleStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  refunded: "Refunded",
  voided: "Voided",
}

const VARIANT = {
  paid: "positive",
  partial: "gold",
  unpaid: "outline",
  refunded: "secondary",
  voided: "destructive",
} as const

/** The money's verdict on a sale: never a stored flag, always derived from receipts and returns. */
export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>
}
