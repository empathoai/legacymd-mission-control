import { ExecutiveReportsView } from "@/components/reports/executive-reports-view"
import { getExecutiveReport } from "@/lib/reports"

export const dynamic = "force-dynamic"

export default async function Page() {
  const data = await getExecutiveReport()
  return <ExecutiveReportsView data={data} />
}
