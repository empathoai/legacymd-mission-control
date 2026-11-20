-- 093300_sale_refunds.sql
-- Money leaving a sale. The sale is never edited: the return points at it.
-- The amount and method are fixed at creation; only the state moves.

create table if not exists public.sale_refunds (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  refunded_on   date not null,
  method_id     uuid not null references public.payment_methods(id) on delete restrict,
  kind          text not null check (kind in ('refund', 'chargeback')),
  state         text not null default 'pending' check (state in ('pending', 'refunded')),
  refunded_at   date,
  external_id   text,
  reason        text not null check (length(btrim(reason)) >= 4),
  recorded_by   text not null,
  created_at    timestamptz not null default now(),
  constraint refunded_has_date check ((state = 'refunded') = (refunded_at is not null))
);

comment on table public.sale_refunds is
  'Money returned to a patient, or taken back by a chargeback. Positive amount; the sale keeps its original total.';
comment on column public.sale_refunds.state is
  'pending means the clinic owes the money; refunded means it left.';

create index if not exists sale_refunds_sale_idx on public.sale_refunds (sale_id);
create index if not exists sale_refunds_date_idx on public.sale_refunds (refunded_on);

create or replace function public.refund_within_collected() returns trigger
language plpgsql as $$
declare
  collected numeric(12,2);
  returned  numeric(12,2);
begin
  select coalesce(sum(r.amount), 0) into collected
  from public.payment_receipts r
  join public.sale_payments p on p.id = r.sale_payment_id
  where p.sale_id = new.sale_id;

  select coalesce(sum(amount), 0) into returned
  from public.sale_refunds where sale_id = new.sale_id;

  if returned + new.amount > collected then
    raise exception 'return of % exceeds the % collected on sale %',
      new.amount, collected - returned, new.sale_id using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists sale_refunds_within_collected on public.sale_refunds;
create trigger sale_refunds_within_collected
  before insert on public.sale_refunds
  for each row execute function public.refund_within_collected();

create or replace function public.refund_only_state_changes() returns trigger
language plpgsql as $$
begin
  if old.state = 'refunded' then
    raise exception 'a refunded return cannot change again' using errcode = '23514';
  end if;
  if new.amount <> old.amount
     or new.sale_id <> old.sale_id
     or new.method_id <> old.method_id
     or new.kind <> old.kind
     or new.refunded_on <> old.refunded_on
     or new.reason <> old.reason then
    raise exception 'only the state of a return can change' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists sale_refunds_state_only on public.sale_refunds;
create trigger sale_refunds_state_only
  before update on public.sale_refunds
  for each row execute function public.refund_only_state_changes();
