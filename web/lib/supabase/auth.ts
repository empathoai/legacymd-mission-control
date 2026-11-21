import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function env(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} must be set in web/.env.local`)
  }

  return value
}

const url = env("NEXT_PUBLIC_SUPABASE_URL")
// The publishable key is enough: it only reaches the auth endpoints.
// The secret key is the fallback until the publishable key is in .env.local;
// neither key ever leaves the server.
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env("SUPABASE_SECRET_KEY")

export async function createAuthClient() {
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    // The session cookie is read by the server only: no browser client exists
    // in this app. `httpOnly` keeps it out of reach of any script, and `secure`
    // keeps it off plain HTTP in production.
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // A Server Component cannot write cookies; the proxy refreshes
          // the session and writes them on the response instead.
        }
      },
    },
  })
}
