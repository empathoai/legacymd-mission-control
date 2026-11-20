import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The dev badge sits over the sidebar footer and hides the Settings item.
  // The prototype is shown to the owner, so keep the corner clean.
  devIndicators: false,
}

export default nextConfig
