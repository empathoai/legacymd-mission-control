import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { createAuthClient } from "@/lib/supabase/auth"

export type SessionUser = {
  id: string
  email: string
}

// Verifies the token's signature on every call, so a forged cookie never
// becomes a user. Cached per request because the layout and actions both ask.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createAuthClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    return null
  }

  const claims = data.claims as { sub?: string; email?: string }

  if (!claims.sub) {
    return null
  }

  return { id: claims.sub, email: claims.email ?? claims.sub }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()

  if (user) {
    return user
  }

  // Development runs without the gate on purpose (see proxy.ts): a screen can be
  // reviewed with no password. A production build always asks for the session.
  if (process.env.NODE_ENV !== "production") {
    return { id: "dev", email: "dev@local" }
  }

  redirect("/login")
}

// Every write records who made it: the clinic account that is signed in.
export async function actor(): Promise<string> {
  const user = await requireUser()
  return user.email
}
