import type { NextConfig } from "next"

const SECURITY_HEADERS = [
  // No browser code talks to Supabase: everything is server-side, so `self` is
  // the only origin the page needs. `unsafe-inline` stays for styles and for
  // Next's bootstrap script; the libraries used here emit inline style tags.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  // Two years, subdomains included: the site is HTTPS-only on the host.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
]

const nextConfig: NextConfig = {
  // The dev badge sits over the sidebar footer and hides the Settings item.
  // The prototype is shown to the owner, so keep the corner clean.
  devIndicators: false,
  // The stack is public knowledge, but advertising it adds nothing.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
