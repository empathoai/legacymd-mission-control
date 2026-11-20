-- 093400_adjustments.sql
-- Money events that are not a sale and not a return: a forgiven remainder, a no-show fee,
-- an unallocated deposit. Two signed deltas, and the constraints decide what each kind
-- may do so the balance identity stays simple.

create table if not exists public.adjustments (
  id             uuid primary key default gen_random_uuid(),
  occurred_on    date not null,
  customer_id    uuid references public.customers(id) on delete restrict,
  sale_id        uuid references public.sales(id) on delete restrict,
  kind           text not null check (kind in ('write_off', 'no_show', 'other')),
  revenue_delta  numeric(12,2) not null default 0,
  cash_delta     numeric(12,2) not null default 0,
  reason         text not null check (length(btrim(reason)) >= 4),
  recorded_by    text not null,
  created_at     timestamptz not null default now(),
  constraint adjustment_moves_something check (revenue_delta <> 0 or cash_delta <> 0),
  constraint write_off_is_negative check (
    kind <> 'write_off' or (revenue_delta <= 0 and cash_delta = 0)
  ),
  constraint no_show_is_settled check (
    kind <> 'no_show' or (revenue_delta > 0 and cash_delta = revenue_delta)
  )
);

comment on table public.adjustments is
  'Signed revenue and cash deltas that are neither a sale nor a return. A write-off lowers revenue with no cash; a no-show raises both equally.';

create index if not exists adjustments_date_idx on public.adjustments (occurred_on);
create index if not exists adjustments_customer_idx on public.adjustments (customer_id);
create index if not exists adjustments_sale_idx on public.adjustments (sale_id);
