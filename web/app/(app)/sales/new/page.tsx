import { SaleForm } from "@/components/sale-form"
import {
  listPaymentMethods,
  listSellableItems,
  listSources,
} from "@/lib/sale-entry"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [items, sources, methods] = await Promise.all([
    listSellableItems(),
    listSources(),
    listPaymentMethods(),
  ])

  return <SaleForm items={items} sources={sources} methods={methods} />
}
