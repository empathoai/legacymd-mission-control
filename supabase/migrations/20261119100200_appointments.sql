-- 100200_appointments.sql
-- The booking log. A booking always belongs to a customer: the desk searches by name and
-- creates the customer when the name is new. Nothing here touches money.
--
-- Three times:
--   scheduled_at   the slot, with the hour
--   scheduled_on   the local business day, generated in America/New_York
--   resolved_on    the local day the outcome was marked, audit only
--
-- Attendance metrics group by scheduled_on, never by resolved_on: a no-show marked late
-- would land in the wrong week.

alter table public.customers
  add column if not exists phone text,
  add column if not exists birth_date date;

alter table public.customers drop constraint if exists customers_phone_sane;
alter table public.customers
  add constraint customers_phone_sane check (
    phone is null or length(btrim(phone)) between 7 and 32
  );

alter table public.customers drop constraint if exists customers_birth_date_sane;
alter table public.customers
  add constraint customers_birth_date_sane check (
    birth_date is null or birth_date > date '1900-01-01'
  );

comment on column public.customers.phone is
  'Contact phone, as typed at the desk. Not a key and not unique.';
comment on column public.customers.birth_date is
  'Optional. Eases the handoff to Patient Fusion; never selected by a report.';

create table if not exists public.appointments (
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

comment on table public.appointments is
  'One row per booking. booked -> show_up | no_show | cancelled, once. No money.';
comment on column public.appointments.status is
  'booked, show_up, no_show or cancelled. Terminal once resolved.';
comment on column public.appointments.expected_category_id is
  'What the clinic expects to sell. The sold category lives on the sale line.';
comment on column public.appointments.resolved_on is
  'Local day the outcome was marked. Audit only; rates group by scheduled_on.';

create index if not exists appointments_slot_idx
  on public.appointments (scheduled_on);
create index if not exists appointments_status_idx
  on public.appointments (status, scheduled_on);
create index if not exists appointments_customer_idx
  on public.appointments (customer_id, scheduled_at);

create table if not exists public.appointment_changes (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointments(id) on delete restrict,
  old_scheduled_at  timestamptz not null,
  new_scheduled_at  timestamptz not null,
  changed_at        timestamptz not null default now(),
  changed_by        text not null,
  reason            text not null check (length(btrim(reason)) >= 4),
  constraint change_moves_the_slot check (old_scheduled_at <> new_scheduled_at)
);

comment on table public.appointment_changes is
  'Every reschedule: from, to, when, who and why. Append-only, like a receipt.';

create index if not exists appointment_changes_idx
  on public.appointment_changes (appointment_id, changed_at);

alter table public.sales
  add column if not exists appointment_id uuid
    references public.appointments(id) on delete restrict;

create unique index if not exists sales_appointment_once
  on public.sales (appointment_id) where appointment_id is not null;

comment on column public.sales.appointment_id is
  'The booking this sale came from. Written once at insert; null for a walk-in.';

alter table public.appointments enable row level security;
alter table public.appointment_changes enable row level security;
