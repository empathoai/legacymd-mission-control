-- 20261122110000_date_guards.sql
-- The review's second data finding: the functions accepted any date. A sale dated 2099 landed
-- in a 2099 month; a receipt dated 2099 added cash to a year that does not exist; a return
-- could be settled before it was registered, and nobody was recorded as having settled it.
--
-- The guards live on the tables, not inside one function, so every write path inherits them:
-- a sale cannot be in the future and cannot be billed before its business day, an installment
-- cannot be due before the sale, a receipt cannot arrive in the future or before the sale, and
-- a return cannot be dated in the future or settled before it was registered.
--
-- `settle_return` gains the actor. It is dropped and recreated because a fourth parameter
-- without a default would leave the three-argument version callable.

alter table public.sale_refunds
  add column if not exists settled_by text;

comment on column public.sale_refunds.settled_by is
  'Who marked the money as returned. Set by settle_return; the registration keeps recorded_by.';

create or replace function public.guard_sale_dates()
returns trigger
language plpgsql
as $fn$
begin
  if new.occurred_on > current_date then
    raise exception 'a sale cannot be dated in the future (%)', new.occurred_on
      using errcode = '23514';
  end if;
  if new.billed_at is not null
     and (new.billed_at at time zone 'America/New_York')::date < new.occurred_on then
    raise exception 'the billing moment (%) is before the business day (%)',
      (new.billed_at at time zone 'America/New_York')::date, new.occurred_on
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;

drop trigger if exists sales_dates on public.sales;
create trigger sales_dates
  before insert or update on public.sales
  for each row execute function public.guard_sale_dates();

create or replace function public.guard_payment_dates()
returns trigger
language plpgsql
as $fn$
declare
  v_occurred date;
begin
  select s.occurred_on into v_occurred
  from public.sales s where s.id = new.sale_id;

  if v_occurred is not null and new.due_on < v_occurred then
    raise exception 'an installment (%) cannot be due before its sale (%)', new.due_on, v_occurred
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;

drop trigger if exists sale_payments_dates on public.sale_payments;
create trigger sale_payments_dates
  before insert or update on public.sale_payments
  for each row execute function public.guard_payment_dates();

create or replace function public.guard_receipt_dates()
returns trigger
language plpgsql
as $fn$
declare
  v_occurred date;
begin
  if new.received_on > current_date then
    raise exception 'a receipt cannot arrive in the future (%)', new.received_on
      using errcode = '23514';
  end if;

  select s.occurred_on into v_occurred
  from public.sale_payments p
  join public.sales s on s.id = p.sale_id
  where p.id = new.sale_payment_id;

  if v_occurred is not null and new.received_on < v_occurred then
    raise exception 'a receipt (%) cannot arrive before its sale (%)', new.received_on, v_occurred
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;

drop trigger if exists payment_receipts_dates on public.payment_receipts;
create trigger payment_receipts_dates
  before insert or update on public.payment_receipts
  for each row execute function public.guard_receipt_dates();

create or replace function public.guard_return_dates()
returns trigger
language plpgsql
as $fn$
declare
  v_occurred date;
begin
  select s.occurred_on into v_occurred
  from public.sales s where s.id = new.sale_id;

  if new.refunded_on > current_date then
    raise exception 'a return cannot be dated in the future (%)', new.refunded_on
      using errcode = '23514';
  end if;
  if v_occurred is not null and new.refunded_on < v_occurred then
    raise exception 'a return (%) cannot be dated before its sale (%)', new.refunded_on, v_occurred
      using errcode = '23514';
  end if;
  if new.state = 'refunded' and new.refunded_at is not null then
    if (new.refunded_at at time zone 'America/New_York')::date < new.refunded_on then
      raise exception 'a return cannot be settled (%) before it was registered (%)',
        (new.refunded_at at time zone 'America/New_York')::date, new.refunded_on
        using errcode = '23514';
    end if;
    if (new.refunded_at at time zone 'America/New_York')::date > current_date then
      raise exception 'a return cannot be settled in the future (%)', new.refunded_at
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists sale_refunds_dates on public.sale_refunds;
create trigger sale_refunds_dates
  before insert or update on public.sale_refunds
  for each row execute function public.guard_return_dates();

drop function if exists public.settle_return(uuid, date, text);

create function public.settle_return(
  p_id uuid,
  p_on date,
  p_external_id text,
  p_by text
)
returns void
language plpgsql
as $fn$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'settled_by is required' using errcode = '22023';
  end if;
  if p_on is null then
    raise exception 'the date the money left is required' using errcode = '22023';
  end if;

  update public.sale_refunds
  set state = 'refunded',
      refunded_at = p_on,
      external_id = coalesce(p_external_id, external_id),
      settled_by = p_by
  where id = p_id and state = 'pending';

  if not found then
    raise exception 'return % does not exist or is already settled', p_id
      using errcode = '23503';
  end if;
end;
$fn$;

do $$
begin
  if (select count(*) from pg_trigger
      where tgname in ('sales_dates', 'sale_payments_dates', 'payment_receipts_dates', 'sale_refunds_dates')) <> 4 then
    raise exception 'C: expected four date triggers';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'settle_return'
      and p.oid::regprocedure::text = 'settle_return(uuid,date,text,text)'
  ) then
    raise exception 'C: settle_return did not gain the actor';
  end if;

  raise notice 'dates are guarded on four tables; settle_return records the actor';
end $$;
