import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function env(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} must be set in web/.env.local`)
  }

  return value
}

const url = env("NEXT_PUBLIC_SUPABASE_URL")
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env("SUPABASE_SECRET_KEY")

function redirectWith(to: URL, from: NextResponse) {
  const response = NextResponse.redirect(to)

  // The refresh writes new cookies: carry them (and their cache headers) onto
  // the redirect, or the next request signs the user out again.
  for (const cookie of from.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie)
  }

  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(name)
    if (value) response.headers.set(name, value)
  }

  return response
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // The gate is for production. In development it stays open so the owner or
  // another agent can review a screen without a password; a build is always
  // gated, and a write still records an actor (see lib/auth.ts).
  if (process.env.NODE_ENV !== "production") {
    return response
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }

        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value)
        }
      },
    },
  })

  // getClaims verifies the signature; getSession would trust the cookie.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  if (!signedIn) {
    if (pathname === "/login") return response

    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.search = ""
    login.searchParams.set("next", `${pathname}${search}`)

    return redirectWith(login, response)
  }

  if (pathname === "/login") {
    const home = request.nextUrl.clone()
    home.pathname = "/"
    home.search = ""
    return redirectWith(home, response)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|webp|svg|ico)$).*)",
  ],
}
