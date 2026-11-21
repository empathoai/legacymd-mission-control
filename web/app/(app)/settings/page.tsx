import { ModulePlaceholder } from "@/components/module-placeholder"

export default function Page() {
  return (
    <ModulePlaceholder
      title="Settings"
      description="The catalogs the clinic edits, and who may use the app."
      points={[
        "Channels (sources) and categories, open catalogs the clinic can extend.",
        "Payment methods and the clinic timezone.",
        "Team access and role permissions.",
      ]}
    />
  )
}
