-- 20261121070000_customer_merges.sql
-- One patient, one row.
--
-- The consolidated import keyed customers on the exact normalized name, so the same
-- person spelled two ways became two customers: history split, visits numbered twice,
-- balances apart. The master already had `aliases` for the extra spellings, but nothing
-- wrote to it.
--
-- A merge is a master correction, not a transaction: it moves sales, appointments and
-- adjustments to the surviving row, appends the retired spellings to `aliases`, and
-- records itself here before the duplicate is removed. The row is never deleted from
-- this table, so every merge is auditable and can be walked back by hand if it was
-- wrong.

create table if not exists public.customer_merges (
  id                uuid primary key default gen_random_uuid(),
  from_id           uuid not null,
  from_name         text not null,
  into_id           uuid not null references public.customers(id) on delete restrict,
  into_name         text not null,
  sales_moved       integer not null default 0,
  appointments_moved integer not null default 0,
  evidence          text not null check (length(btrim(evidence)) >= 8),
  merged_at         timestamptz not null default now()
);

create index if not exists customer_merges_into_idx
  on public.customer_merges (into_id, merged_at);

comment on table public.customer_merges is
  'One row per retired duplicate customer: where it went, what moved and why. Append-only evidence of a master correction.';

create or replace function public.customer_merges_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'customer_merges is append-only' using errcode = '23514';
end;
$$;

drop trigger if exists customer_merges_append_only on public.customer_merges;
create trigger customer_merges_append_only
  before update or delete on public.customer_merges
  for each row execute function public.customer_merges_immutable();

revoke update, delete on public.customer_merges from anon, authenticated;
