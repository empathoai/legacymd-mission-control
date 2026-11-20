"use server"

import { redirect } from "next/navigation"

import { createAuthClient } from "@/lib/supabase/auth"

export type LoginState = {
  error: string | null
  email: string
}

const EMPTY: LoginState = { error: null, email: "" }

function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null
  }

  return value
}

export async function signIn(
  previous: LoginState = EMPTY,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? previous.email)
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Enter your email and password.", email }
  }

  const supabase = await createAuthClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  // The same message for a wrong password and an unknown email: the screen
  // must not reveal which accounts exist.
  if (error) {
    return { error: "Wrong email or password.", email }
  }

  redirect(safeNext(String(formData.get("next") ?? "")) ?? "/")
}

export async function signOut() {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  redirect("/login")
}
