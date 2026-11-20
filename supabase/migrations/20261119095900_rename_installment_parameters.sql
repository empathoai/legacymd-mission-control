-- 095900_rename_installment_parameters.sql
-- The last Spanish left in the database was the parameter name p_cuota_id. A parameter
-- name cannot be renamed with create or replace, so the two functions are dropped and
-- recreated; nothing depends on them yet.

drop function if exists public.void_payment(uuid, text, text);

create function public.void_payment(
  p_installment_id uuid,
  p_by             text,
  p_reason         text
) returns void
language plpgsql
as $$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'voided_by is required' using errcode = '22023';
  end if;
  update public.sale_payments
  set status = 'void', voided_at = now(), void_reason = p_reason, voided_by = p_by
  where id = p_installment_id and status = 'pending';
  if not found then
    raise exception 'installment % does not exist or is not pending', p_installment_id
      using errcode = '23503';
  end if;
end;
$$;

comment on function public.void_payment(uuid, text, text) is
  'Voids one pending installment and records who and why. The guard refuses one with receipts.';

drop function if exists public.reschedule_payment(uuid, date, text, text);

create function public.reschedule_payment(
  p_installment_id uuid,
  p_new_due        date,
  p_by             text,
  p_reason         text
) returns void
language plpgsql
as $$
declare
  old_due date;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'changed_by is required' using errcode = '22023';
  end if;
  if p_new_due is null then
    raise exception 'a new due date is required' using errcode = '22023';
  end if;

  select due_on into old_due
  from public.sale_payments
  where id = p_installment_id and status = 'pending';

  if old_due is null then
    raise exception 'installment % does not exist or is not pending', p_installment_id
      using errcode = '23503';
  end if;

  update public.sale_payments set due_on = p_new_due where id = p_installment_id;

  insert into public.sale_payment_changes
    (sale_payment_id, old_due_on, new_due_on, changed_by, reason)
  values
    (p_installment_id, old_due, p_new_due, p_by, p_reason);
end;
$$;

comment on function public.reschedule_payment(uuid, date, text, text) is
  'Moves a pending installment to a new date and writes the audit row. Refuses a past date, a void installment or one with receipts.';
