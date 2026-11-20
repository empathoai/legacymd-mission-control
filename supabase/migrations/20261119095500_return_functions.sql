-- 095500_return_functions.sql
-- The reversal module has two operations and a clean API for the screen:
--   register_return  the owner picks the invoice and the customer, types the amount, the
--                     method, the date and the reason. The row is born pending: the clinic
--                     owes the money and the balance goes negative.
--   settle_return    the money left. The row becomes refunded and the balance returns to
--                     zero, because the refund cancels revenue and cash alike.
-- Nothing here touches sales. The invoice keeps its total, its lines and its receipts.

create or replace function public.register_return(
  p_sale_id     uuid,
  p_amount      numeric,
  p_method_id   uuid,
  p_on          date,
  p_kind        text,
  p_reason      text,
  p_by          text,
  p_external_id text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'recorded_by is required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 4 then
    raise exception 'a reason of at least 4 characters is required' using errcode = '22023';
  end if;

  insert into public.sale_refunds
    (sale_id, amount, refunded_on, method_id, kind, state, reason, recorded_by, external_id)
  values
    (p_sale_id, p_amount, p_on, p_method_id, p_kind, 'pending', p_reason, p_by, p_external_id)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.register_return(uuid, numeric, uuid, date, text, text, text, text) is
  'Registers a return against a sale. Born pending: the clinic owes it. The cap against collected is enforced by trigger.';

create or replace function public.settle_return(
  p_id          uuid,
  p_on          date,
  p_external_id text default null
) returns void
language plpgsql
as $$
begin
  if p_on is null then
    raise exception 'the date the money left is required' using errcode = '22023';
  end if;

  update public.sale_refunds
  set state = 'refunded',
      refunded_at = p_on,
      external_id = coalesce(p_external_id, external_id)
  where id = p_id and state = 'pending';

  if not found then
    raise exception 'return % does not exist or is already settled', p_id using errcode = '23503';
  end if;
end;
$$;

comment on function public.settle_return(uuid, date, text) is
  'Marks a return as paid. Only the state moves; amount, method and kind never change.';
