export function clinicToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/**
 * Turns a wall time the desk picked ("2026-11-21", 9, 30) into the instant it
 * happens in the clinic, whatever the browser's zone is. A slot typed without an
 * offset would be read as UTC by Postgres, so the offset is resolved here, twice:
 * the second pass covers the hour the DST switch lands in.
 */
export function clinicWallToUtcIso(
  day: string,
  hour: number,
  minute: number
): string {
  const [year, month, date] = day.split("-").map(Number)
  const guess = Date.UTC(year, month - 1, date, hour, minute)

  const offsetAt = (stamp: number): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    }).formatToParts(new Date(stamp))
    const label =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT"
    const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (!match) return 0
    const sign = match[1] === "-" ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
  }

  let instant = guess - offsetAt(guess) * 60_000
  instant = guess - offsetAt(instant) * 60_000
  return new Date(instant).toISOString()
}

export function formatClinicDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}
