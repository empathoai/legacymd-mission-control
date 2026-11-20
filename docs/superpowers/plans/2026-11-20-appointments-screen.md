# Appointments Screen and GHL Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/appointments` from a placeholder into the clinic's agenda of record: book, see who is coming, mark the outcome, and receive the bot's bookings from GoHighLevel.

**Architecture:** The existing Postgres functions (`book_appointment`, `resolve_appointment`, `reschedule_appointment`) stay the only writers; a migration adds an idempotent external variant, an `external_ref`, and a calendar→category map. Server components read through `web/lib/appointments.ts`; three client components hold the dialogs. One Route Handler receives GHL's webhook.

**Tech Stack:** Next.js 16.4.5 App Router, React 19, shadcn/ui over Base UI, Tailwind v4, Supabase Postgres via the secret key (server only).

**Spec:** `docs/SDD-appointments.md` §10–§12.

## Global Constraints

- Code, comments and UI copy in English; the conversation in Spanish.
- Every control is an installed shadcn/Base UI component; add a missing one with `pnpm exec shadcn add <name>`. No native `<select>`.
- The transactional base is immutable. Appointments are written only by `book_appointment`, `book_appointment_external`, `resolve_appointment` and `reschedule_appointment`.
- Money is untouched by this module.
- Clinic day is `America/New_York`; `scheduled_on` is generated there. Pagination is 20 rows.
- The secret key never reaches the browser; `/api/ghl/appointments` is the only public route and it requires `x-ghl-secret`.

## Review Focus

- **A slot that passed unmarked** must stay on the agenda flagged `Late`, resolvable, not disappear.
- **A delivery at 23:30 or 00:30** must land on the clinic day, and `Today` must follow the clinic clock, not the browser's.
- **The same GHL appointment twice** must produce one booking and answer 200 both times.
- **An unmapped calendar** must produce no booking and no orphan customer: map first, then resolve the customer.
- **Two tabs resolving one booking** must leave the second with a readable error, not a crash.

---

### Task 1: Migration — external ref, calendar map, idempotent booking

**Files:**
- Create: `supabase/migrations/20261120120100_appointment_intake.sql`

**Interfaces:**
- Produces: `appointments.external_ref text null` (unique); `public.ghl_calendar_map(calendar_id text pk, calendar_name text, category_id uuid, source_id uuid, active boolean, created_at, updated_at)`; `public.book_appointment_external(p_customer_id uuid, p_scheduled_at timestamptz, p_category_id uuid, p_source_id uuid, p_ref text, p_by text) returns uuid`, idempotent on `p_ref`.

- [x] **Step 1:** Write the migration: `add column if not exists external_ref text`; `create unique index appointments_external_ref_uidx on public.appointments (external_ref)` (NULLs are distinct, so every desk booking may stay null); comments; `create table if not exists public.ghl_calendar_map` with FKs `on delete restrict`; `alter table ... enable row level security`; the function with the guard order (actor, ref, customer, category, source, then insert), `insert ... on conflict (external_ref) do nothing returning id`, and a re-select when `v_id` is null.
- [x] **Step 2:** Apply: `py scripts/apply_migrations.py` (from the repo root). Expected: one file applied, ledger updated.
- [x] **Step 3:** Verify in a rollback: booking with a fresh ref returns an id; the same call returns **the same** id and leaves one row; `external_ref` null twice is accepted; the new table has `relrowsecurity`.
- [x] **Step 4:** `py scripts/run_checks.py` → 17 checks, controls and baseline green.
- [x] **Step 5:** Commit the migration.

### Task 2: `web/lib/appointments.ts` — reads

**Files:**
- Create: `web/lib/appointments.ts`
- Read: `web/lib/sales.ts`, `web/lib/dates.ts`, `web/lib/patients.ts` for the house style.

**Interfaces:**
- Produces:
  - `type AppointmentStatus = "booked" | "show_up" | "no_show" | "cancelled"`
  - `type AgendaRow = { id, scheduledAt, slotLabel, dayLabel, scheduledOn, isToday, isLate, patientId, patientName, categoryLabel, sourceLabel, via: "bot" | "desk" }`
  - `type HistoryRow = AgendaRow & { status: AppointmentStatus, cancelReason: string | null, resolvedBy: string | null }`
  - `listAgenda(query?: string): Promise<AgendaRow[]>` — every `booked`, ascending by `scheduled_at`, `q` matches the patient name.
  - `listHistory(page: number, filter?: { date?: string; from?: string; to?: string }, query?: string): Promise<{ rows: HistoryRow[]; total: number; page: number; pageCount: number }>` — resolved only, 20 per page, ordered by `scheduled_at` desc.
  - `listAppointmentOptions(): Promise<{ categories: Option[]; sources: Option[] }>`
- Modify: `web/lib/dates.ts` — add `clinicWallToUtcIso(day: string, hour: number, minute: number): string`: build the UTC guess, read the clinic offset with `Intl.DateTimeFormat(..., { timeZoneName: "shortOffset" })`, correct once and refine once (DST edge). The dialog never sends a wall time without an offset.

- [x] **Step 1:** Implement the three functions with the nested select `id, scheduled_at, scheduled_on, status, external_ref, cancel_reason, resolved_by, customers(id, full_name), categories(label), sources(label)`. `via` is `external_ref ? "bot" : "desk"`. `isToday` uses `clinicToday()`; `isLate` is `new Date(scheduled_at) < new Date()`.
- [x] **Step 2:** Verify the helper with node: `2026-11-21 09:30` → `14:30Z`, `2026-07-21 09:30` → `13:30Z`.
- [x] **Step 3:** `pnpm exec tsc --noEmit` in `web/` → clean.
- [x] **Step 4:** Commit.

### Task 3: `web/app/appointments/actions.ts` — writes

**Files:**
- Create: `web/app/appointments/actions.ts`

**Interfaces:**
- Produces:
  - `type ActionResult = { ok: true } | { ok: false; error: string }`
  - `bookAppointment(input: { customerId: string | null; name: string; phone: string | null; scheduledAt: string; categoryId: string; sourceId: string }): Promise<ActionResult & { id?: string }>` — when `customerId` is null it calls `resolve_customer(name, phone)` first.
  - `resolveAppointmentAction(id: string, status: "show_up" | "no_show" | "cancelled", reason?: string): Promise<ActionResult>`
  - `rescheduleAppointmentAction(id: string, scheduledAt: string, reason: string): Promise<ActionResult>`
  - `searchAppointmentPatients(query: string): Promise<{ id, fullName, phone, visits, balance }[]>`
- Actor constant `"front-desk"`, as in `sales/actions.ts`. `revalidatePath("/appointments")` and `revalidatePath("/", "layout")` on success.

- [x] **Step 1:** Implement the four actions against `supabase.rpc(...)`, mapping `error.message` to `{ ok: false, error }`.
- [x] **Step 2:** `tsc --noEmit` → clean.
- [x] **Step 3:** Commit.

### Task 4: The screen

**Files:**
- Modify: `web/app/appointments/page.tsx`
- Create: `web/components/appointment-search.tsx` (client, mirrors `catalog-search.tsx`)
- Create: `web/components/appointment-row-actions.tsx` (client: Show up, No-show, Cancel dialog with reason, Reschedule dialog with day + slot + reason)
- Create: `web/components/new-appointment-dialog.tsx` (client: patient search, `Calendar` + slot `Select`, category `Select`, source `Select`)

**Interfaces:**
- Consumes: Task 2's types, Task 3's actions.
- Produces: none.

- [x] **Step 1:** `page.tsx` reads `tab`, `q`, `date`, `from`, `to`, `page`. Tab links keep `q`. Agenda: table `Hour · Patient · Expects · Source · Via · Actions`, with `Today` and `Late` badges in the Hour cell, one heading per day. History: `DateFilter` (default today), `Outcome · Reason` columns, 20-row pagination preserving the filter. Root `mx-auto w-full max-w-5xl`, table `w-full table-fixed` with fixed widths, like the catalog.
- [x] **Step 2:** The dialog's slot `Select` runs 08:00–19:00 in 15-minute steps; the chosen day plus the slot become an ISO string in `America/New_York`.
- [x] **Step 3:** Playwright: force dark, open `/appointments`, screenshot the agenda, open New booking, screenshot the dialog, book one, resolve it No-show, confirm it leaves the agenda and appears in History; resolve the same booking from a stale page and read the error. Read the images back.
- [x] **Step 4:** `tsc --noEmit` and `pnpm build` → clean.
- [x] **Step 5:** Commit.

### Task 5: GHL webhook

**Files:**
- Create: `web/app/api/ghl/appointments/route.ts`

**Interfaces:**
- Consumes: `book_appointment_external`, `resolve_customer`.
- Produces: `POST` returning `200 { id }` on success or duplicate, `401` without the secret, `500` when `GHL_WEBHOOK_SECRET` is unset, `422 { error }` when the calendar is unmapped or the contact has no usable name.

- [x] **Step 1:** Implement: secret check with `crypto.timingSafeEqual`; tolerant body parse (`body.appointment ?? body.calendar?.appointment`, `startTime`, `calendarId`, contact name/phone); map lookup **first**; `resolve_customer`; `book_appointment_external(r, 'ghl')`.
- [x] **Step 2:** With `next dev` running: `curl` without the header → 401; with the header and an unmapped calendar → 422 and no customer row created; with a seeded mapping → 200 and one appointment; the same body again → 200 with the same id and still one row.
- [x] **Step 3:** Remove the test mapping and the test appointment.
- [x] **Step 4:** `tsc --noEmit` and `pnpm build` → clean.
- [x] **Step 5:** Commit.

### Task 6: Close-out

- [x] Update `docs/SDD-appointments.md` §11 with the payload shape actually received.
- [x] `memory/next-actions.md`, `current-strategy.md`, `bugs-and-risks.md`, `decisions.md`, `session-summaries.md`.
- [x] `AGENTS.md` header and routes line.
- [x] Commit.
