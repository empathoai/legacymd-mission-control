# Pre-release corrections — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the data-layer and build blockers from the 2026-11-21 pre-release review, so the app can move to the security review without a known way to corrupt money or fail the checks.

**Architecture:** One Postgres migration per behaviour change, each preceded by the check (or the rollback probe) that fails without it and followed by `py scripts/apply_migrations.py` plus `py scripts/run_checks.py`. The web app changes only in `web/package.json` and `web/.env.local`; no screen is touched — those belong to the owner.

**Tech Stack:** PostgreSQL 17 (Supabase, remote), Python 3 scripts driven by the Management API (`scripts/query.py`, `apply_migrations.py`, `run_checks.py`), Next.js 16.4.5 + pnpm 11 in `web/`.

**Spec:** [`../../pre-release-review-2026-11-21.md`](../../pre-release-review-2026-11-21.md) — sections 1, 2 and 6.

## Global Constraints

- The transactional base is immutable: no migration in this plan updates or deletes a sale, a line, a receipt or an amount. Every probe runs inside `begin; … rollback;`.
- Every migration is a new file in `supabase/migrations/`, applied once through `scripts/apply_migrations.py`; never edit an applied migration.
- `docs/data/baseline.json` is compared, never regenerated.
- Every new check ships with a control in `supabase/checks/controls/` that must fire.
- Views stay `security_invoker = true`; grants to `anon`/`authenticated` stay at zero; RLS stays on with zero policies.
- Code, comments, database messages and documentation in English. Neutral copy.
- No UI change: `web/app/**` and `web/components/**` are the owner's. This plan touches `web/package.json` and `web/.env.local` only.
- Money rules from `AGENTS.md`: balance = sold + adjustments(revenue − cash) − collected − pending returns; margin from the cost interval covering `billed_at`.

## Review Focus

- **A cuota cancelled after part of it was collected** — only the uncollected remainder may be written off, never the whole installment.
- **A sale entered today for yesterday's business day** — `occurred_on` in the past is normal; `billed_at` may not be earlier than `occurred_on`, and no date may be in the future.
- **A cost interval that starts at midnight New York on a DST change** — `cost_on(date)` must answer that interval's cost, not the previous one.
- **A price change dated today while a later interval already exists** — the catalog column must not jump backwards.
- **The same card charge delivered twice** — the second receipt must be refused, not added to cash. (Already closed: the partial unique index on `payment_receipts.external_id` in `20261121270000`; the probe that produced `23505` is recorded in the review doc.)

---

### Task 1: The publishable key stops the auth fallback

**Files:**
- Modify: `web/.env.local` (add `SUPABASE_PUBLISHABLE_KEY`; value copied from the root `.env.local`)
- Verify: `web/lib/supabase/auth.ts:20-23`, `web/proxy.ts:15-18`
- Test: a Node probe that resolves the same chain the two files use

**Interfaces:**
- Produces: `SUPABASE_PUBLISHABLE_KEY` present in the Next process, so `createServerClient` receives it as `apikey` instead of the secret.

- [ ] **Step 1: Write the failing probe**

```js
// shots/probe-env.mjs — run with: node shots/probe-env.mjs
import { loadEnvConfig } from "@next/env"
loadEnvConfig("F:/EmpathoAI-projects/legacymd-mission-control/web")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const pub = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
console.log("url:", Boolean(url), "publishable:", Boolean(pub), "secret:", Boolean(process.env.SUPABASE_SECRET_KEY))
if (!pub) process.exit(1)
```

- [ ] **Step 2: Run it and see it fail**

Run: `node shots/probe-env.mjs`
Expected: `publishable: false`, exit 1.

- [ ] **Step 3: Copy the key**

Append `SUPABASE_PUBLISHABLE_KEY=<value from the root .env.local>` to `web/.env.local`. Do not print the value.

- [ ] **Step 4: Run the probe again**

Expected: `url: true publishable: true secret: true`, exit 0.

- [ ] **Step 5: Prove the build still starts without it**

Run: `pnpm build` in `web/` — exit 0. Then delete `shots/probe-env.mjs`. No commit: `web/.env.local` is gitignored.

---

### Task 2: A cancelled installment writes off what it stops expecting

**Files:**
- Create: `supabase/migrations/20261122100000_void_payment_writes_off.sql`
- Create: `supabase/checks/c21_cancelled_installment_writes_off.sql`
- Create: `supabase/checks/controls/c21_cancelled_installment_writes_off.control.sql`
- Modify: `public.void_payment(text, uuid, text)` in the migration

**Interfaces:**
- Consumes: `sale_payments(id, sale_id, amount, status)`, `payment_receipts(sale_payment_id, amount)`, `adjustments(sale_id, customer_id, kind, revenue, cash, reason, recorded_by)`, `sales(customer_id, occurred_on)`.
- Produces: `void_payment(p_by text, p_payment_id uuid, p_reason text)` — unchanged signature; after it runs, `sum(adjustments.revenue where kind = 'write_off' and sale_id = …)` equals the installment amount minus the receipts on it.

- [ ] **Step 1: Write the failing check**

```sql
-- C21: a cancelled installment must have written off exactly what it still expected.
select p.id, p.sale_id, p.amount,
       coalesce(sum(r.amount), 0) as collected,
       coalesce(sum(a.revenue), 0) as written_off
from public.sale_payments p
left join public.payment_receipts r on r.sale_payment_id = p.id
left join public.adjustments a
       on a.sale_id = p.sale_id and a.kind = 'write_off'
      and a.reason = concat('cancelled installment ', p.id::text)
where p.status = 'void'
group by p.id, p.sale_id, p.amount
having coalesce(sum(a.revenue), 0) <> p.amount - coalesce(sum(r.amount), 0);
```

- [ ] **Step 2: Run it and see it pass with no rows, then break it with a probe**

Run: `py scripts/run_checks.py` → C21 `0 rows` (no voided installment exists yet).
Probe in a rollback: create a sale with two 50,00 installments, cancel the second with `void_payment`, run the C21 body → it must return 1 row today.

- [ ] **Step 3: Implement the write-off in `void_payment`**

Keep the signature. Before setting `status = 'void'`, compute
`v_remaining := p.amount - coalesce(sum(receipts), 0)`; if `v_remaining > 0`, insert into
`adjustments` one row with `kind = 'write_off'`, `revenue = v_remaining`, `cash = 0`,
`reason = 'cancelled installment ' || p.id`, `recorded_by = p_by`, and the sale's
`customer_id`/occurred month. Reject a reason shorter than 4 characters.

- [ ] **Step 4: Add the control**

The control creates a sale with an unpaid installment, cancels it **without** writing off
(simulating the old function inside the transaction), and expects C21 to fire. Rollback.

- [ ] **Step 5: Apply and verify**

Run: `py scripts/apply_migrations.py` then `py scripts/run_checks.py`
Expected: `c21: 0 rows`, `control c21: fired (1 row)`, `baseline: holds (435 sales)`, `checks: 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261122100000_void_payment_writes_off.sql supabase/checks/c21_cancelled_installment_writes_off.sql supabase/checks/controls/c21_cancelled_installment_writes_off.control.sql
git commit -m "A cancelled installment writes off what it stops expecting"
```

---

### Task 3: No date can be in the future, and a return says who settled it

**Files:**
- Create: `supabase/migrations/20261122110000_date_guards.sql`
- Create: `supabase/checks/c22_no_future_dates.sql` (+ control)
- Modify: `create_sale`, `record_receipt`, `register_return`, `settle_return`

**Interfaces:**
- Produces: `create_sale(...)` raises `22023` when `occurred_on > current_date` or `billed_at::date < occurred_on` or a `due_on < occurred_on`; `record_receipt(...)` raises when `received_on > current_date` or `received_on < sale.occurred_on`; `register_return(...)` raises when `refunded_on > current_date`; `settle_return(p_by text, p_return_id uuid, p_on date)` — **new first parameter** `p_by`; the web action passes `actor()`.

- [ ] **Step 1: Write the failing check**

```sql
select 'sale' as what, id::text, occurred_on::text from public.sales where occurred_on > current_date
union all
select 'receipt', id::text, received_on::text from public.payment_receipts where received_on > current_date
union all
select 'return', id::text, refunded_on::text from public.sale_refunds where refunded_on > current_date;
```

- [ ] **Step 2: Run it** — `0 rows` today; the probe in Step 3 must show the old functions accept 2099.

- [ ] **Step 3: Add the guards** to the four functions, unchanged signatures except `settle_return`, which gains `p_by text` and writes it to `recorded_by`.

- [ ] **Step 4: Update the caller** `web/app/(app)/sales/actions.ts` only if it calls `settle_return` — it does not; the caller is `web/app/(app)/sales/returns/actions.ts`. Pass `await actor()`.

- [ ] **Step 5: Rollback probes** — each of the four calls with a 2099 date must raise; a normal call must still succeed.

- [ ] **Step 6: Apply, `run_checks.py`, commit** — message: `Dates stay in the past; a settled return records its actor`.

---

### Task 4: `set_item_price` never moves the catalog backwards

**Files:**
- Create: `supabase/migrations/20261122120000_set_item_price_guard.sql`
- Modify: `public.set_item_price(text, uuid, numeric, timestamptz, text)`

**Interfaces:**
- Produces: the same signature; the catalog column is written only when `p_from` is at or after the newest interval's start, or when no later interval exists.

- [ ] **Step 1: Failing probe** — in a rollback, `set_item_price('treatment', PCK-0002, 1.00, '2026-01-01')` leaves `treatments.price = 1.00` while `price_on(today) = 357.00`; run the C20 body → it returns a row.
- [ ] **Step 2: Implement** — compare `p_from` with `max(effective_from)`; when a later interval exists, update only the history and leave the column.
- [ ] **Step 3: Re-run the probe** — C20 body returns 0 rows after the call.
- [ ] **Step 4: Apply, `run_checks.py` (C20 must stay green), commit.**

---

### Task 5: `cost_on(date)` answers the day the clinic means

**Files:**
- Create: `supabase/migrations/20261122130000_cost_on_clinic_midnight.sql`
- Create: `supabase/checks/c23_cost_on_matches_interval.sql` (+ control)
- Modify: `public.cost_on(text, uuid, date)`

**Interfaces:**
- Produces: `cost_on(kind, id, p_on)` resolves `p_on` at midnight `America/New_York`, so `cost_on(kind, id, effective_from::date)` returns that interval's cost — including the 59 intervals that start at New York midnight.

- [ ] **Step 1: Failing check**

```sql
select h.item_kind, h.item_id, h.effective_from::date as day, h.cost,
       public.cost_on(h.item_kind, h.item_id, h.effective_from::date) as answered
from public.item_cost_history h
where public.cost_on(h.item_kind, h.item_id, h.effective_from::date) is distinct from h.cost;
```

Expected today: **56 rows** — the intervals that start at New York midnight resolve a day early.
- [ ] **Step 2: Implement** `p_on::timestamp at time zone 'America/New_York'` instead of `p_on::timestamptz`.
- [ ] **Step 3: Re-run** — 0 rows.
- [ ] **Step 4: Verify no money view moved** — `monthly_pl` gross margin stays 74.873,66; `run_checks.py` green.
- [ ] **Step 5: Add the control** (an interval dated at NY midnight whose UTC date is the next day must still resolve), apply, commit.

---

### Task 6: The suite keeps its own promises

**Files:**
- Create: `supabase/checks/c16_balance_rows_have_money.control.sql`
- Modify: `supabase/checks/controls/c11_views_and_grants.control.sql`

- [ ] **Step 1: Write the C16 control** — a customer_balances row with money and no sale, expecting `C16` to fire; rollback.
- [ ] **Step 2: Fix the C11 control** — drop the `ensure_rls` event trigger inside the transaction before `create table control_no_rls`, so the RLS branch is actually tested; rollback.
- [ ] **Step 3: Run `py scripts/run_checks.py`** — 20 checks, **20 controls**, 0 failed.
- [ ] **Step 4: Commit** — `The suite tests every check it ships`.

---

### Task 7: The build is pinned and its production graph is clean

**Files:**
- Modify: `web/package.json` (add `"engines": { "node": ">=22" }` and `"packageManager": "pnpm@11.22.0"`; move `shadcn` from `dependencies` to `devDependencies`)
- Create: `web/.nvmrc` containing `22`

**Interfaces:**
- Produces: `pnpm audit --prod` exits 0; `pnpm install --frozen-lockfile` and `pnpm build` still exit 0.

- [ ] **Step 1: Baseline the failure** — `pnpm audit --prod` exits 1 with the `minimatch` advisory.
- [ ] **Step 2: Edit `package.json`** as above and run `pnpm install` (lockfile updates).
- [ ] **Step 3: Verify** — `pnpm audit --prod` exit 0; `pnpm build` exit 0; `pnpm install --frozen-lockfile` exit 0.
- [ ] **Step 4: Commit** — `Pin Node 22 and keep the build tooling out of production`.

---

### Task 8: The record matches the code

**Files:**
- Modify: `AGENTS.md:34-36` (migration count, remove the appointments agenda and `/api/ghl/appointments`)
- Modify: `docs/HANDOFF.md` (migration count, gross margin 74.873,66, `import_review` 0 rows, drop `refunded_by_item`)
- Modify: `memory/bugs-and-risks.md` (the "no remote" row: the remote exists, 17 commits are ahead)

- [ ] **Step 1: Count reality** — `select count(*) from public.schema_migrations` and the build route table.
- [ ] **Step 2: Rewrite the three lines** with those numbers.
- [ ] **Step 3: Verify** — `git grep -n "101 files"` and `git grep -n "api/ghl"` return nothing.
- [ ] **Step 4: Commit** — `The map matches the code`.

---

## Not in this plan

- **The screens** (drawer that never closes, `/expenses/<period>` at 680 px, Returns/Voids action column, catalog names at 84 px, KPI truncation, lint errors inside components): the owner's, with the other agent. Listed in `memory/next-actions.md`.
- **`create_sale` and unpriced items / free-text lines**: needs the owner's call on whether a free-text line is sellable after the cutover; C05 keeps reporting it meanwhile.
- **Publishing**: out of scope until every blocker is closed.

## Verification for the whole plan

```bash
py scripts/apply_migrations.py
py scripts/run_checks.py          # 20 checks, 20 controls, baseline 435
cd web && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm audit --prod
```
