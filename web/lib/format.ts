const currencyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const currencyWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function formatMoney(value: number): string {
  return currencyExact.format(value)
}

export function formatMoneyWhole(value: number): string {
  return currencyWhole.format(value)
}

export function formatMoneyShort(value: number): string {
  return Math.abs(value) >= 1000
    ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
    : `$${Math.round(value)}`
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(digits)}%`
}

export function formatMonthLabel(period: string): string {
  const safe = period.length === 7 ? `${period}-01` : period
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${safe}T12:00:00`))
}

export function formatMonthShort(period: string): string {
  const safe = period.length === 7 ? `${period}-01` : period
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(new Date(`${safe}T12:00:00`))
}
