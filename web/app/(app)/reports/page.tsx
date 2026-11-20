import { ModulePlaceholder } from "@/components/module-placeholder"

export default function Page() {
  return (
    <ModulePlaceholder
      title="Reports"
      description="What came in, what each treatment left, and who is still owed."
      points={[
        "Money by month: sold, collected, returns and write-offs, each in its own month.",
        "Margin per treatment and per product, accumulated by month, over known cost only.",
        "Weekly show-ups and no-shows, from appointments.",
        "The monthly box lists what is expected, what is overdue and what was collected.",
      ]}
    />
  )
}
