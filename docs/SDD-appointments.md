# SDD — Appointments and customer master

* **Source:** [concepts_brief-appointments.md](concepts_brief-appointments.md)
* **Status:** implemented (migrations `100200`–`100400`, checks C14–C17)
* **Date:** 2026-11-19

## 1. Scope

Record a booking for a customer, resolve it once, reschedule it with an audit chain, and read
weekly attendance and monthly conversion. A booking always belongs to a customer; the customer
is created by a name search at the desk. Nothing here creates, moves or reads money.

## 2. Model

### 2.1 Customers gain phone and birth date

```sql
alter table public.customers
  add column if not exists phone text,
  add column if not exists birth_date date;

alter table public.customers
  add constraint customers_phone_sane check (
    phone is null or length(btrim(phone)) between 7 and 32
  ),
  add constraint customers_birth_date_sane check (
    birth_date is null or birth_date > date '1900-01-01'
  );
```

A future birth date cannot be a table constraint: `current_date` is not immutable. It is
rejected in `resolve_customer`, the only writer. A future date is a typo, never a fact.

### 2.2 Appointments

```sql
create table public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id) on delete restrict,
  scheduled_at          timestamptz not null,
  scheduled_on          date generated always as
                          ((scheduled_at at time zone 'America/New_York')::date) stored,
  expected_category_id  uuid not null references public.categories(id) on delete restrict,
  source_id             uuid not null references public.sources(id) on delete restrict,
  status                text not null default 'booked'
                          check (status in ('booked', 'show_up', 'no_show', 'cancelled')),
  resolved_at           timestamptz,
  resolved_on           date,
  resolved_by           text,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  created_by            text not null,
  updated_at            timestamptz not null default now(),
  updated_by            text,
  constraint resolved_has_actor check (
    (status = 'booked') = (resolved_at is null and resolved_on is null and resolved_by is null)
  ),
  constraint cancelled_has_reason check (
    (status = 'cancelled') = (cancel_reason is not null and length(btrim(cancel_reason)) >= 4)
  ),
  constraint booked_has_no_reason check (
    status <> 'booked' or cancel_reason is null
  )
);

create index appointments_slot_idx on public.appointments (scheduled_on);
create index appointments_status_idx on public.appointments (status, scheduled_on);
create index appointments_customer_idx on public.appointments (customer_id, scheduled_at);
```

`resolved_on` is the local day the outcome was marked, for audit only. Every attendance metric
groups by `scheduled_on`.

### 2.3 The reschedule audit

```sql
create table public.appointment_changes (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointments(id) on delete restrict,
  old_scheduled_at  timestamptz not null,
  new_scheduled_at  timestamptz not null,
  changed_at        timestamptz not null default now(),
  changed_by        text not null,
  reason            text not null check (length(btrim(reason)) >= 4),
  constraint change_moves_the_slot check (old_scheduled_at <> new_scheduled_at)
);

create index appointment_changes_idx
  on public.appointment_changes (appointment_id, changed_at);
```

Append-only, same posture as `payment_receipts`: `revoke update, delete` and a trigger that
refuses both.

### 2.4 The sale link

```sql
alter table public.sales
  add column if not exists appointment_id uuid
    references public.appointments(id) on delete restrict;

create unique index sales_appointment_once
  on public.sales (appointment_id) where appointment_id is not null;
```

Written once at insert, never updated. A walk-in sale has it null.

## 3. Functions, the only supported writes

### 3.1 `normalize_person_name(text)` — immutable

The import normalized customers with: drop the tail after `-`, `/`, `(`, lowercase, strip
accents, replace every non-alphanumeric with a space, collapse. The SQL version must produce
the same string, or the desk would not find the 188 existing customers.

```sql
create or replace function public.normalize_person_name(p_name text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(regexp_replace(p_name, '\s*[-–—/()]\s*.*$', '')),
               'áàäâãéèëêíìïîóòöôõúùüûñç',
               'aaaaaeeeeiiiiooooouuuunc'),
             '[^a-z0-9]+', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;
```

Verified against the live data: all 188 existing rows satisfy
`normalized_name = normalize_person_name(full_name)`, zero differences. The desk will find
every imported customer by the name on her chart.

### 3.2 `resolve_customer(name, phone, birth_date)` — the only writer of the master

```sql
create or replace function public.resolve_customer(
  p_name  text,
  p_phone text default null,
  p_birth date default null
) returns uuid
language plpgsql as $$
declare
  v_norm text;
  v_id   uuid;
begin
  if p_name is null or length(btrim(p_name)) < 2 then
    raise exception 'a name of at least 2 characters is required' using errcode = '22023';
  end if;
  if p_birth is not null and p_birth > current_date then
    raise exception 'a birth date cannot be in the future' using errcode = '22023';
  end if;

  v_norm := public.normalize_person_name(p_name);

  select id into v_id from public.customers where normalized_name = v_norm;
  if v_id is not null then
    update public.customers
    set phone = coalesce(phone, p_phone),
        birth_date = coalesce(birth_date, p_birth)
    where id = v_id;
    return v_id;
  end if;

  insert into public.customers (full_name, normalized_name, aliases, phone, birth_date)
  values (btrim(p_name), v_norm, '{}', p_phone, p_birth)
  on conflict (normalized_name) do nothing;

  select id into v_id from public.customers where normalized_name = v_norm;
  return v_id;
end;
$$;
```

An existing customer keeps the data it has; the desk can correct it later.

### 3.3 `book_appointment(...)`

```sql
create or replace function public.book_appointment(
  p_customer_id      uuid,
  p_scheduled_at     timestamptz,
  p_category_id      uuid,
  p_source_id        uuid,
  p_by               text
) returns uuid
```

Validates the customer, category and source exist, `p_by` is not empty, and inserts with
`status = 'booked'`. A past slot is allowed: the clinic types yesterday's Excel today.

### 3.4 `resolve_appointment(...)`

```sql
create or replace function public.resolve_appointment(
  p_id     uuid,
  p_status text,
  p_by     text,
  p_reason text default null
) returns void
```

Only from `booked`. `p_status` in `show_up`, `no_show`, `cancelled`; `cancelled` requires a
reason of at least four characters. Writes `resolved_at = now()`, `resolved_on = (now() at
time zone 'America/New_York')::date`, `resolved_by = p_by`, `cancel_reason`.

### 3.5 `reschedule_appointment(...)`

```sql
create or replace function public.reschedule_appointment(
  p_id      uuid,
  p_new_at  timestamptz,
  p_by      text,
  p_reason  text
) returns void
```

Only from `booked`, only into the future, reason of at least four characters. Inserts the
audit row **before** the update, so the guard trigger can verify it:

```sql
insert into public.appointment_changes
  (appointment_id, old_scheduled_at, new_scheduled_at, changed_by, reason)
values (p_id, v_old, p_new_at, p_by, p_reason);

update public.appointments
set scheduled_at = p_new_at, updated_at = now(), updated_by = p_by
where id = p_id;
```

### 3.6 `guard_appointment()` — before update

* refuses any change when `old.status <> 'booked'`: a resolved booking never changes again;
* refuses a `scheduled_at` change unless a matching `appointment_changes` row exists
  (`old = old.scheduled_at`, `new = new.scheduled_at`), so a raw update cannot move a booking
  without its audit;
* refuses a status change that is not `booked → terminal`;
* sets `updated_at = now()` when `updated_by` is provided.

### 3.7 `link_sale_appointment()` — before insert on `sales`

When `new.appointment_id` is not null:

* the appointment exists and its `customer_id` equals `new.customer_id`;
* its status is `booked` or `show_up`, never `no_show` or `cancelled`;
* if it is `booked`, the sale resolves it to `show_up` with `resolved_by = 'system'`, because
  a sale proves attendance.

## 4. Views

### 4.1 `appointment_funnel`

```sql
create view public.appointment_funnel with (security_invoker = true) as
select
  date_trunc('week', scheduled_on)::date                                   as week_start,
  count(*)                                                                 as bookings,
  count(*) filter (where status = 'show_up')                               as show_ups,
  count(*) filter (where status = 'no_show')                               as no_shows,
  count(*) filter (where status = 'cancelled')                             as cancelled,
  count(*) filter (where status = 'booked')                                as unresolved,
  round(100.0 * count(*) filter (where status = 'show_up')
        / nullif(count(*) filter (where status in ('show_up', 'no_show')), 0), 1)
                                                                           as show_up_rate
from public.appointments
group by 1;
```

`show_up_rate` is null when a week has no resolved bookings.

### 4.2 `appointment_conversion`

```sql
create view public.appointment_conversion with (security_invoker = true) as
select date_trunc('month', first_show_on)::date as month,
       count(*)                                  as conversions
from (
  select customer_id, min(scheduled_on) as first_show_on
  from public.appointments
  where status = 'show_up'
  group by customer_id
) first_show
group by 1;
```

LTV is `customer_balances.sold_total`, which already sums non-voided sales per customer.

### 4.3 `customer_balances` narrows to customers with a money fact

Same columns, one added condition:

```sql
where sd.customer_id is not null
   or co.customer_id is not null
   or ad.customer_id is not null
   or ob.customer_id is not null
```

A no-show customer has none of the four, so the balance list never shows her. The twelve
customers who currently sit at 0,00 leave the view.

## 5. Access

```sql
alter table public.appointments        enable row level security;
alter table public.appointment_changes enable row level security;
```

Zero policies, as every other table. C11 gains a third arm: every table in `public` has
`relrowsecurity`.

## 6. Checks and controls

| Check | Asserts | Control |
|---|---|---|
| C14 | for every appointment, the latest `appointment_changes` row ends at its current `scheduled_at`, and the chain is unbroken | move a slot with the guard disabled |
| C15 | every `sales.appointment_id` points to an appointment of the same customer, `show_up`, and a non-voided sale | insert a sale against a foreign appointment with the trigger disabled |
| C16 | every row in `customer_balances` has at least one money fact | none needed: the view filter is the invariant, and a view cannot hold a row it excludes |
| C17 | no appointment is `show_up` with a `resolved_by` that is empty, and no resolved booking lacks its three controls | update a row with the check constraint disabled |

C16 has no control because it cannot be violated through the view; it is listed as a
regression guard for a future edit of the filter. The other three carry controls that break the
rule inside a transaction and roll back.

## 7. Migration order

| File | Contains |
|---|---|
| `20261119100200_appointments.sql` | customers columns, `appointments`, `appointment_changes`, `sales.appointment_id`, indexes, RLS |
| `20261119100300_appointment_functions.sql` | normalizer, `resolve_customer`, book/resolve/reschedule, guard trigger, sales trigger, revoke on the audit table |
| `20261119100400_appointment_views.sql` | `appointment_funnel`, `appointment_conversion`, `customer_balances` narrowed |

Checks live in `supabase/checks/`, never in migrations, and run through
`scripts/run_checks.py` after every batch.

Rollback is a forward file `20261119100500_drop_appointments.sql`: drop the views and the
functions, drop `sales.appointment_id`, drop `appointment_changes` and `appointments`, restore
`customer_balances` without the filter. Customers keep their new phone and birth date columns;
dropping them would lose data.

## 8. Test plan

Before the migration is accepted:

1. `normalize_person_name(full_name)` equals `normalized_name` for all 188 customers.
2. `resolve_customer` twice with the same name returns the same id; with a new name creates one.
3. A booking for a past slot is accepted; a reschedule into the past is refused.
4. `resolve_appointment` twice raises: the second call finds no `booked` row.
5. A reschedule writes one audit row and the chain check passes; a raw `update` of
   `scheduled_at` raises.
6. A sale against another customer's appointment raises; a sale against a `no_show` raises; a
   sale against a `booked` appointment leaves it `show_up`.
7. The funnel reconciles: `bookings = show_ups + no_shows + cancelled + unresolved` per week.
8. A customer created by a booking appears in `customers` and not in `customer_balances`.
9. The 432 sales and 219.492,91 are untouched; C08 still passes.

## 9. Out of scope

Availability, capacity, reminders, no-show fees, automatic package sessions, and the bot's
**status** sync: GHL sends the booking, never a show-up or a no-show. The pipeline stays theirs.
Listed so the next reader does not assume them.

## 10. The desk screen (2026-11-20)

`/appointments` stops being a placeholder and becomes the agenda of record: the bot's bookings
and the desk's bookings meet here, and the outcome is marked here. Two doors in, one status out.

### 10.1 What the owner said

* The bot books on its own and GHL receives it. The clinic moves that pipeline to show-up or
  no-show, but **nothing of that comes back to us**: the only thing GHL sends is the appointment.
* Referrals, the website and phone calls **do not pass through the bot and never reach GHL**.
  Those are booked here, by the desk.
* So this app cannot be a mirror of GHL. It is the only place where the whole day exists, and
  the only place where attendance is recorded.

### 10.2 Shape

Two tabs, because there are two questions.

**Agenda** — every `booked` booking, ordered by `scheduled_at` ascending. No date filter: a slot
that passed unmarked stays at the top, flagged `Late`, until somebody resolves it, so nothing
rots at the bottom of a list. Today's rows carry a `Today` pill; the rest are grouped by local
day.

| Hour | Patient | Expects | Source | Via | · | Actions |
|---|---|---|---|---|---|---|
| 09:30 | Ana López | Aesthetics | Website | Bot | | Show up · No-show · Cancel · Reschedule |
| 10:00 | María Ruiz | Men's Health | Referral | Desk | | Show up · No-show · Cancel · Reschedule |

`Via` is `Bot` when `external_ref` is not null and `Desk` otherwise. It matters: a Bot row is one
the pipeline also knows about.

**History** — the resolved bookings, `Day | Range` filter (default today) and 20 rows per page,
in the same shape as Sales details: hour, patient, expects, source, outcome, reason for a
cancellation, who resolved it.

Both tabs take a patient search (`q`), because "when does María come" is asked as often as
"who is coming today". The search filters the tab in place.

`New booking` sits at the top right, aligned with the table, like `New item` in the catalog.

### 10.3 New booking

One dialog, the same patient search-or-create the sale screen uses:

1. Patient: search by name; a match fills name, phone and visits. No match offers "Create
   <name>" with the phone field.
2. Slot: a `Calendar` for the day plus a `Select` of 15-minute slots, 08:00–19:00. No native
   datetime input.
3. Expects: one of the four categories.
4. Source: one of the five channels.
5. Book → `book_appointment(customer_id, scheduled_at, category_id, source_id, 'front-desk')`.

A past slot is allowed, as the function already documents: the desk types yesterday today.

### 10.4 Resolve and reschedule

* **Show up / No-show** — one click, no confirmation. `resolve_appointment(id, status, 'front-desk')`.
* **Cancel** — dialog with a required reason (≥ 4 characters, the database refuses less).
* **Reschedule** — dialog with the new day and slot plus a required reason. It calls
  `reschedule_appointment`, which writes the audit row first. A resolved booking offers no
  actions at all, and the guard would refuse them anyway.
* A booked row whose slot already passed shows `Late` but keeps the same four actions.

Nothing here edits a name, a phone or a source after the fact: the booking is the record. If the
name is wrong, that is a customer-master problem, not a booking one.

## 11. GHL intake — booking only (2026-11-20)

### 11.1 Transport

`POST /api/ghl/appointments`, a Route Handler. A GHL workflow with the **Customer Booked
Appointment** trigger and a **Custom Webhook** action points at it. There is no OAuth and no
polling: GHL pushes, we receive.

* The route requires `x-ghl-secret` to equal `GHL_WEBHOOK_SECRET` (server env). Anything else
  is `401`. The URL alone is not the secret.
* The body is parsed for: contact name, phone, `appointment.id`, `appointment.startTime`,
  `appointment.calendarId`. The exact shape is captured from the first real delivery before the
  parser is considered done; the first delivery is echoed back when the secret is right and the
  body does not parse.
* It answers `200` with the booking id on success and on a duplicate, and `422` with a reason
  when it cannot place the booking (unknown calendar, unknown contact name). GHL retries a
  non-2xx, so a duplicate must not answer `4xx`.

### 11.2 Idempotency

`appointments.external_ref` is `text null`, unique where not null, and holds `ghl:<appointment
id>`. The insert is `on conflict (external_ref) do nothing`; a retry finds the row and returns
its id. A second delivery for the same appointment never creates a second booking.

`external_ref is null` is the meaning of "the desk booked it"; there is no separate
`booked_via` column.

### 11.3 Mapping

```sql
create table public.ghl_calendar_map (
  calendar_id   text primary key,
  calendar_name text,
  category_id   uuid not null references public.categories(id) on delete restrict,
  source_id     uuid not null references public.sources(id) on delete restrict,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

A calendar maps to one expected category and one default source. `expected_category_id` is
`not null` in `appointments` and the bot does not know our taxonomy, so the calendar is the
mapping key. An unmapped `calendarId` answers `422` naming it instead of guessing: a wrong
category on a booking is worse than a missing one, and the fix is one row. The owner gives the
calendar ids once; until then the table is empty and every delivery is a `422`.

The phone and the name come from the GHL contact. `resolve_customer(name, phone)` normalises the
name, so a returning patient lands on her existing row.

### 11.4 What it does not do

* It never resolves a booking. GHL does not send show-up or no-show.
* It never reschedules or cancels: an appointment moved inside GHL stays where it was here, and
  the desk fixes it with the Reschedule action, which writes the audit row.
* It does not read availability and does not check overlaps. Booking is a log, as §1 says.

### 11.5 The delivery, as observed (2026-11-20)

The parser accepts two shapes, because GHL sends either the flattened fields or the
appointment nested beside the contact:

```json
{ "appointmentId": "…", "startTime": "2026-11-25T10:30:00-05:00", "calendarId": "…",
  "firstName": "Berta", "lastName": "Salinas", "phone": "5551234567" }
```

and the same values under `appointment: { id, startTime, calendarId }` with
`contact: { fullName, phone }`. `startTime` keeps its offset; it is stored as a
`timestamptz`, and `scheduled_on` follows the clinic day.

`GHL_WEBHOOK_SECRET` lives in `web/.env.local` (and in Vercel's environment later). Without
it the route answers `500` and says so in the server log; a missing or wrong
`x-ghl-secret` answers `401`. Neither case creates a customer.

### 11.6 Prerequisite

GHL needs a public URL, so the route is testable only after a Vercel deploy or a tunnel. The
screen ships first and works with no GHL at all.

### 11.7 Status (2026-11-20) — built, dormant

The bot writes its bookings to the clinic's Google Calendar, so the intended feeder is that
calendar's secret iCal feed: it carries the moves and cancellations the webhook never would, and
one feeder cannot duplicate another. The route above stays in the code as the alternative; it is
dormant because no deployed environment has `GHL_WEBHOOK_SECRET` and `ghl_calendar_map` is empty.
The Google feed needs access to the clinic's Google account, which nobody has yet, plus one real
event to write the parser against.

## 12. Build order

1. Migration `20261120120100_appointment_intake.sql`: `external_ref` + unique index,
   `ghl_calendar_map`, RLS on.
2. `web/lib/appointments.ts`: agenda, history and the lookups the form needs.
3. `web/app/appointments/actions.ts`: book, resolve, reschedule, patient search.
4. The screen: two tabs, the table, the three dialogs.
5. `/api/ghl/appointments` and the mapping table's rows, once the owner sends the calendar ids.

Steps 1–4 are verifiable with Playwright and the database alone. Step 5 waits for the deploy.
