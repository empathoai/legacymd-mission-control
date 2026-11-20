-- 20261120130200_record_receipt.sql
-- The payment plan could be created but never discharged: create_sale was the only
-- writer of receipts. This is the missing half, and nothing else.
--
-- A receipt is evidence that money arrived. It never edits the installment, never
-- touches the sale and never changes a price: it is appended, and the schedule is
-- read as amount minus receipts.

create or replace function public.record_receipt(
  p_sale_payment_id uuid,
  p_amount          numeric,
  p_on              date,
  p_method_id       uuid,
  p_by              text,
  p_note            text default null,
  p_external_id     text default null
) returns uuid
language plpgsql
as $$
declare
  v_id     uuid;
  v_status text;
  v_voided timestamptz;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'recorded_by is required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'a receipt has to be more than zero' using errcode = '22023';
  end if;
  if p_on is null then
    raise exception 'the day the money arrived is required' using errcode = '22023';
  end if;

  select p.status, s.voided_at
  into v_status, v_voided
  from public.sale_payments p
  join public.sales s on s.id = p.sale_id
  where p.id = p_sale_payment_id;

  if v_status is null then
    raise exception 'installment % does not exist', p_sale_payment_id using errcode = '23503';
  end if;
  if v_status <> 'pending' then
    raise exception 'installment % is void', p_sale_payment_id using errcode = '23514';
  end if;
  if v_voided is not null then
    raise exception 'the sale of installment % is voided', p_sale_payment_id using errcode = '23514';
  end if;
  if not exists (select 1 from public.payment_methods where id = p_method_id) then
    raise exception 'method % does not exist', p_method_id using errcode = '23503';
  end if;

  -- The cap against what the installment still expects is enforced by the
  -- receipt_within_expected trigger, so there is exactly one place for that rule.
  insert into public.payment_receipts
    (sale_payment_id, amount, received_on, method_id, source, recorded_by, note, external_id)
  values
    (p_sale_payment_id, p_amount, p_on, p_method_id, 'manual', p_by,
     nullif(btrim(coalesce(p_note, '')), ''), p_external_id)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_receipt(uuid, numeric, date, uuid, text, text, text) is
  'Records money that arrived against one installment. Appended, never edited; the schedule is read as amount minus receipts.';
