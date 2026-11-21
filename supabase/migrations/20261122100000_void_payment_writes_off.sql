-- 20261122100000_void_payment_writes_off.sql
-- The review found the gap: `void_payment` cancelled an installment and nothing else, so
-- C01 stopped matching (`sold` no longer equalled `planned − write_off`) and the balance kept
-- charging a cuota the clinic had forgiven. D5 already says the default is to forgive.
--
-- The signature does not change. What it adds: when the cancelled installment still expected
-- money (its amount minus the receipts on it), one `adjustments` row of kind 'write_off'
-- records that amount as negative revenue, dated the day it is cancelled (D4: a write-off
-- belongs to the month it happens). C01 reads that row; the balance stops charging it.
--
-- A reason is required and has to say something, the same four characters the screen asks for.

create or replace function public.void_payment(
  p_installment_id uuid,
  p_by text,
  p_reason text
)
returns void
language plpgsql
as $fn$
declare
  v_sale        uuid;
  v_customer    uuid;
  v_amount      numeric(12,2);
  v_collected   numeric(12,2);
  v_remaining   numeric(12,2);
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'voided_by is required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 4 then
    raise exception 'a reason of at least 4 characters is required' using errcode = '22023';
  end if;

  select p.sale_id, s.customer_id, p.amount
    into v_sale, v_customer, v_amount
  from public.sale_payments p
  join public.sales s on s.id = p.sale_id
  where p.id = p_installment_id and p.status = 'pending';

  if not found then
    raise exception 'installment % does not exist or is not pending', p_installment_id
      using errcode = '23503';
  end if;

  select coalesce(sum(amount), 0)
    into v_collected
  from public.payment_receipts
  where sale_payment_id = p_installment_id;

  v_remaining := round(v_amount - v_collected, 2);

  update public.sale_payments
  set status = 'void',
      voided_at = now(),
      void_reason = btrim(p_reason),
      voided_by = p_by
  where id = p_installment_id;

  if v_remaining > 0 then
    insert into public.adjustments
      (occurred_on, customer_id, sale_id, kind, revenue_delta, cash_delta, reason, recorded_by)
    values
      (current_date, v_customer, v_sale, 'write_off', -v_remaining, 0,
       'cancelled installment ' || p_installment_id::text || ': ' || btrim(p_reason), p_by);
  end if;
end;
$fn$;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'void_payment'
      and p.oid::regprocedure::text = 'void_payment(uuid,text,text)'
  ) then
    raise exception 'C: void_payment changed its signature';
  end if;

  if pg_get_functiondef('public.void_payment(uuid,text,text)'::regprocedure) not ilike '%write_off%' then
    raise exception 'C: void_payment does not write the write-off';
  end if;

  raise notice 'void_payment now writes off what the cancelled installment expected';
end $$;
