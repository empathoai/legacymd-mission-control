import "server-only"

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

if (!url || !secret) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in web/.env.local"
  )
}

export const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})
