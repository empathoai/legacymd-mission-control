import "server-only"

import { supabase } from "@/lib/supabase/server"
import { pageWindow } from "@/lib/pagination"

export const SALE_LINES_PER_PAGE = 20

export type SaleLine = {
  saleItemId: string
  saleId: string
  occurredOn: string
  customerId: string
  customerName: string
  voided: boolean
  kind: "treatment" | "product" | "service" | "other"
  unitType: "unit" | "package" | null
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
  listPrice: number | null
  discount: number
}

export type SaleLinePage = {
  rows: SaleLine[]
  total: number
  page: number
  pageCount: number
}

export async function listSaleLines(
  page = 1,
  filter?: { date?: string; from?: string; to?: string }
): Promise<SaleLinePage> {
  const window = await pageWindow(
    () => {
      let countQuery = supabase
        .from("sale_lines")
        .select("sale_item_id", { count: "exact", head: true })

      if (filter?.date) countQuery = countQuery.eq("occurred_on", filter.date)
      if (filter?.from) countQuery = countQuery.gte("occurred_on", filter.from)
      if (filter?.to) countQuery = countQuery.lte("occurred_on", filter.to)

      return countQuery
    },
    page,
    SALE_LINES_PER_PAGE,
    "sale lines query failed"
  )

  let query = supabase
    .from("sale_lines")
    .select(
      "sale_item_id, sale_id, occurred_on, customer_id, customer_name, voided, kind, unit_type, item_name, quantity, unit_price, line_total, list_price, discount"
    )

  if (filter?.date) {
    query = query.eq("occurred_on", filter.date)
  }
  if (filter?.from) {
    query = query.gte("occurred_on", filter.from)
  }
  if (filter?.to) {
    query = query.lte("occurred_on", filter.to)
  }

  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("sale_id", { ascending: true })
    .range(window.start, window.end)

  if (error) {
    throw new Error(`sale lines query failed: ${error.message}`)
  }

  return {
    rows: (data ?? []).map((row) => ({
      saleItemId: row.sale_item_id as string,
      saleId: row.sale_id as string,
      occurredOn: row.occurred_on as string,
      customerId: row.customer_id as string,
      customerName: row.customer_name as string,
      voided: row.voided as boolean,
      kind: row.kind as SaleLine["kind"],
      unitType: (row.unit_type as "unit" | "package" | null) ?? null,
      itemName: (row.item_name as string | null) ?? "—",
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      lineTotal: Number(row.line_total),
      listPrice: row.list_price === null ? null : Number(row.list_price),
      discount: Number(row.discount),
    })),
    total: window.total,
    page: window.page,
    pageCount: window.pageCount,
  }
}
