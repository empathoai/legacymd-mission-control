import Image from "next/image"

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-legacymd.webp"
      alt="LegacyMD"
      width={192}
      height={192}
      priority
      className={className}
    />
  )
}
