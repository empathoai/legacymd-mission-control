-- 093200_payment_receipts.sql
-- The evidence that money arrived. A installment keeps the plan; a receipt proves a payment.
-- Two partial receipts are allowed; a duplicate webhook is not; an edit never.

create table if not exists public.payment_receipts (
  id               uuid primary key default gen_random_uuid(),
  sale_payment_id  uuid not null references public.sale_payments(id) on delete restrict,
  amount           numeric(12,2) not null check (amount > 0),
  received_on      date not null,
  method_id        uuid not null references public.payment_methods(id) on delete restrict,
  external_id      text,
  stripe_event_id  text unique,
  source           text not null check (source in ('manual', 'webhook', 'import')),
  recorded_by      text not null,
  note             text,
  created_at       timestamptz not null default now()
);

comment on table public.payment_receipts is
  'Append-only evidence of money received against a planned installment. Paid and partial are derived: nothing is stored twice.';
comment on column public.payment_receipts.received_on is
  'Bank date of the money, not the date the row was typed.';
comment on column public.payment_receipts.stripe_event_id is
  'Unique: a repeated webhook is rejected instead of recording the same money twice.';

create index if not exists payment_receipts_installment_idx on public.payment_receipts (sale_payment_id);
create index if not exists payment_receipts_received_idx on public.payment_receipts (received_on);

create or replace function public.receipt_within_expected() returns trigger
language plpgsql as $$
declare
  expected numeric(12,2);
  already  numeric(12,2);
begin
  select amount into expected from public.sale_payments where id = new.sale_payment_id;
  if expected is null then
    raise exception 'installment % does not exist', new.sale_payment_id using errcode = '23503';
  end if;
  select coalesce(sum(amount), 0) into already
  from public.payment_receipts where sale_payment_id = new.sale_payment_id;
  if already + new.amount > expected then
    raise exception 'receipt of % exceeds the % still expected on installment %',
      new.amount, expected - already, new.sale_payment_id using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_receipts_within_expected on public.payment_receipts;
create trigger payment_receipts_within_expected
  before insert on public.payment_receipts
  for each row execute function public.receipt_within_expected();

create or replace function public.receipts_are_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'payment receipts are append-only: record a return instead of editing or deleting one'
    using errcode = '23514';
end;
$$;

drop trigger if exists payment_receipts_immutable on public.payment_receipts;
create trigger payment_receipts_immutable
  before update or delete on public.payment_receipts
  for each row execute function public.receipts_are_immutable();

revoke update, delete on public.payment_receipts from service_role;
