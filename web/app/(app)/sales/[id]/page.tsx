import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { SaleStatusBadge } from "@/components/sale-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatClinicDay } from "@/lib/dates"
import { formatMoney } from "@/lib/format"
import { getSale } from "@/lib/sales"

export const dynamic = "force-dynamic"

function kindLabel(kind: string, unitType: string | null) {
  if (kind === "treatment") {
    if (unitType === "package") return "Package"
    if (unitType === "membership") return "Membership"
    return "Treatment"
  }
  if (kind === "product") return "Product"
  if (kind === "service") return "Service"
  return "Other"
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="rounded-lg border p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p
        className={
          tone === "muted"
            ? "text-xl font-semibold tabular-nums text-muted-foreground"
            : "text-xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  )
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sale = await getSale(id)
  if (!sale) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          nativeButton={false}
          render={<Link href="/sales/details" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Sales details
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {sale.customerName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Sale of {formatClinicDay(sale.occurredOn)}
              {sale.visitNumber ? ` · visit ${sale.visitNumber}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SaleStatusBadge status={sale.status} />
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/patients/${sale.customerId}`} />}
            >
              Patient
            </Button>
          </div>
        </div>
      </div>

      {sale.voided ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span className="font-medium">This sale was voided.</span>{" "}
          {sale.voidReason ? sale.voidReason : "No reason was recorded."}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Total" value={formatMoney(sale.money.total)} />
        <Figure label="Collected" value={formatMoney(sale.money.collected)} />
        <Figure label="Returned" value={formatMoney(sale.money.returned)} />
        <Figure
          label="Balance"
          value={formatMoney(sale.money.balance)}
          tone={sale.money.balance === 0 ? "muted" : undefined}
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.lines.map((line) => (
              <TableRow key={line.saleItemId}>
                <TableCell className="max-w-xs truncate">{line.itemName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {kindLabel(line.kind, line.unitType)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.quantity}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(line.unitPrice)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(line.lineTotal)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-muted-foreground">
                Total
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(
                  sale.lines.reduce((sum, line) => sum + line.lineTotal, 0)
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Payments</span>
        {sale.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This sale has no payment plan.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.payments.map((payment) => {
                  const received = payment.receipts.reduce(
                    (sum, receipt) => sum + receipt.amount,
                    0
                  )
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatClinicDay(payment.dueOn)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.method ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(received)}
                      </TableCell>
                      <TableCell>
                        {payment.state === "void" ? (
                          <Badge variant="destructive">Cancelled</Badge>
                        ) : received >= payment.amount - 0.005 ? (
                          <Badge variant="positive">Paid</Badge>
                        ) : received > 0 ? (
                          <Badge variant="gold">Partial</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {sale.refunds.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Returns</span>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.refunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatClinicDay(refund.refundedOn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(refund.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {refund.state}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {refund.reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {sale.notes ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Note</span>
          <p className="text-sm text-muted-foreground">{sale.notes}</p>
        </div>
      ) : null}
    </div>
  )
}
