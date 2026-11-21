# Security review — 2026-11-21

Scope: the app as deployed (Hostinger, `real-darkgray-tarsier-88.hostingersite.com`), its data
layer, its build and its repository. Findings are ordered by what a mistake would cost.

## The architecture, and what it makes unnecessary

- **One Next.js server app.** Every screen renders on the server; writes are Server Actions
  (`app/(app)/*/actions.ts`). There is no public API route: `web/app/api/` is gone.
- **One unauthenticated route**: `/login`. `web/proxy.ts` verifies the session with
  `auth.getClaims()` (never `getSession`) on every other request and in production only.
- **Supabase is server-only.** `anon` and `authenticated` hold **no grants** on `public`, every
  view is `security_invoker`, RLS is on with zero policies, and the browser never talks to the
  database — there is no browser client at all. The server uses the secret key.
- **One account, no roles.** There is no admin surface to protect beyond the gate.
- **No uploads, no password handling.** Authentication is Supabase Auth (bcrypt server-side);
  the app never sees a password hash and has no reset or signup screen.

That is why several items on the standard list do not apply here: password hashing, reset-link
expiry, upload limits, CORS, a CSRF token and role-based admin protection have no surface. The
sections below say what was found, what was fixed, and what is accepted with a reason.

## Fixed in this review

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | No security headers: no CSP, no `frame-ancestors`, no HSTS, no `nosniff`. A page with patient names and amounts could be framed, and nothing constrained what a leaked script could load. | `web/next.config.ts` sends CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, `connect-src 'self'`), HSTS two years with subdomains, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. |
| 2 | **Medium** | The session cookie was `httpOnly: false` and had no `Secure` flag (the `@supabase/ssr` default). Any script on the page — or an HTTP request — could carry it. | `cookieOptions: { httpOnly: true, secure: production, sameSite: "lax", path: "/" }` in both `lib/supabase/auth.ts` and `proxy.ts`. The browser client does not exist, so nothing needed the cookie. |
| 3 | **Low** | `X-Powered-By: Next.js` advertised the stack. | `poweredByHeader: false`. |

Verified on a production build: all headers present, `/login` renders with its styles and fonts,
**no console violations**, `/` and `/expenses` still answer 307 to `/login`.

## Verified as already correct

- **No secret in the repository or its history.** A full-history search for `sb_secret_` and
  `sbp_` finds only documentation placeholders; no value was ever committed. `.env.local` and
  `.env.hostinger` are ignored.
- **Minimum privilege at the data layer**: zero grants for `anon`/`authenticated`, zero policies,
  every view `security_invoker`, verified against the live project. A publishable key gets 401.
- **Parameterised queries**: no raw SQL and no string-built SQL in the app; reads go through
  `supabase-js` and writes through Postgres functions with typed parameters.
- **Server-side validation** exists in the write paths: `create_sale`, `record_receipt`,
  `register_return`, `settle_return`, `void_payment` and the catalog actions all reject bad
  input (amounts, quantities, dates, reasons) in the database or the action, not only in the UI.
- **XSS**: React escapes every value; the single `dangerouslySetInnerHTML` is the shadcn chart
  component writing its own generated style tag, with no user data in it.
- **Dependencies**: `pnpm audit --prod` reports **0 vulnerabilities** (the one moderate advisory
  came from a CLI in `dependencies` and left with it).
- **HTTPS**: the host serves TLS and redirects; HSTS is now set by the app as well.
- **CSRF**: Server Actions compare the request `Origin` with the host (Next's built-in check) and
  the session cookie is `SameSite=Lax`, so a cross-site form post carries no credentials.

## Accepted risks, with the reason

1. **No application-level rate limit on login.** Supabase Auth applies its own limits and the
   host sits behind a CDN, but a targeted password-guessing run is bounded only by those. A
   login throttle is the first follow-up before the clinic is public.
2. **The CSP allows `'unsafe-inline'`** for scripts and styles, because Next injects its
   bootstrap inline and the chart library emits style tags. It still blocks third-party script
   origins and framing. A nonce-based CSP is the follow-up.
3. **The server holds the secret key**, so any server-side bug is a full-data bug. The
   compensations are that the browser has no database client, the app is single-tenant and every
   write records its actor.
4. **The desk sets the price.** `create_sale` trusts the `unit_price` the screen sends, because
   the clinic charges above and below list by design. A compromised session could under-price a
   sale; the actor is recorded, and the reconciliation is the control.
5. **Session lifetime is long** (the library's 400-day cookie, refreshed on use). Shortening it
   needs a refresh strategy; noted for the follow-up.
6. **No monitoring beyond host logs.** There is no alert on repeated login failures or unusual
   write volume.

## Not applied — needs a plan before acting

Nothing was revoked, no production setting was changed outside the app, and no history was
rewritten. The following are proposals, not actions:

- **Rotate the account-level `sbp_` token** in the root `.env.local` when the schema work pauses.
  Procedure: create a new token in the Supabase dashboard, replace it, verify the scripts, then
  delete the old one.
- **Rotate the project secret key** only if it ever leaves the host; the same create → replace →
  verify → delete order.
- **Change the clinic password** if it was shared outside the owner; the reset is done in the
  Supabase dashboard, and sessions elsewhere are signed out by it.
- **No Git history rewrite is needed**: no secret was ever committed.

## Checks that could not be performed

- A real sign-in on the deployed site with the clinic password (the owner did it manually; the
  reviewer did not have the credential).
- A full authenticated walk-through of every screen after the CSP change: the gate hid them.
  The login page covered rendering, fonts and console, and the pages share the same assets.
- Brute-force behaviour against Supabase Auth (rate limits are server-side and would need many
  requests).
