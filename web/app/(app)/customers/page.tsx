import { redirect } from "next/navigation"

// Legacy address: the module is "patients" everywhere the owner reads, so this
// path only survives so an old bookmark still lands on the report.
export default function Page() {
  redirect("/patients/report")
}
