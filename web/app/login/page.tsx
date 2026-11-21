import { LoginForm } from "@/components/login-form"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata = {
  title: "Sign in · LegacyMD Mission Control",
}

function safeNext(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined
  }

  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="relative grid min-h-svh bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Brand panel: the clinic's own colours, no data */}
      <aside className="relative hidden overflow-hidden bg-[#17253D] px-14 py-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-[#CEAD3C]/10 blur-3xl"
        />
        <div className="flex items-center gap-3">
          <BrandMark className="size-11 rounded-xl" />
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-xl text-[#F9F8F6]">LegacyMD</span>
            <span className="text-xs tracking-[0.18em] text-[#CEAD3C] uppercase">
              Mission Control
            </span>
          </div>
        </div>

        <div className="max-w-md">
          <p className="font-heading text-4xl leading-tight text-balance text-[#F9F8F6]">
            The clinic&apos;s day, read back without a spreadsheet.
          </p>
          <p className="mt-4 text-base text-[#8D97A6]">
            Patients, treatments, cash collected and what is still owed — recorded as they
            happen, read in one place.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8D97A6]">
          <span className="inline-block size-1.5 rounded-full bg-[#CEAD3C]" />
          Single clinic account · server-side access only
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col items-center justify-center gap-8 px-6 py-12 sm:px-10">
        <div className="flex items-center gap-3 lg:hidden">
          <BrandMark className="size-10 rounded-lg" />
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-lg">LegacyMD</span>
            <span className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Mission Control
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <LoginForm next={safeNext(next)} />
        </div>

        <p className="text-xs text-muted-foreground">
          Access is limited to the clinic team.
        </p>
      </section>
    </main>
  )
}
