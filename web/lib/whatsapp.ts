export function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return null
  if (digits.length === 10) return `1${digits}`
  return digits
}

export function buildWhatsAppHref(
  phone: string | null | undefined,
  message?: string
): string | null {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  if (!message) return `https://wa.me/${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return "there"
  return trimmed.split(/\s+/)[0]
}
