import { ModulePlaceholder } from "@/components/module-placeholder"

export default function Page() {
  return (
    <ModulePlaceholder
      title="Sales report"
      description="The lines are already in Sales details. This report groups them by the filters we define next."
      points={[
        "Totals by month, category, item and payment method.",
        "Discounts given, with the lines that carry them.",
        "New against repeat patients, and the source of the first visit.",
        "The filters are the next decision; the numbers come from the same lines.",
      ]}
    />
  )
}
