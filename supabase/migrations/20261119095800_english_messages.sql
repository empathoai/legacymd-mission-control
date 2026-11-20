-- 095800_english_messages.sql
-- The remaining live objects still used a Spanish domain word in a message or a comment.
-- Recreated in English; behavior is unchanged.

CREATE OR REPLACE FUNCTION public.guard_sale_payment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.status = 'void' and old.status <> 'void' then
    if exists (select 1 from public.payment_receipts where sale_payment_id = new.id) then
      raise exception 'an installment with receipts cannot be voided; record a return instead'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'void' and old.status = 'void' then
    raise exception 'a voided installment cannot change again' using errcode = '23514';
  end if;

  if new.due_on <> old.due_on then
    if old.status <> 'pending' then
      raise exception 'only a pending installment can be rescheduled' using errcode = '23514';
    end if;
    if new.due_on < current_date then
      raise exception 'an installment cannot be rescheduled into the past' using errcode = '23514';
    end if;
    if exists (select 1 from public.payment_receipts where sale_payment_id = new.id) then
      raise exception 'an installment with receipts cannot be rescheduled' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.receipt_within_expected()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_payment(p_cuota_id uuid, p_new_due date, p_by text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
  where id = p_cuota_id and status = 'pending';

  if old_due is null then
    raise exception 'installment % does not exist or is not pending', p_cuota_id using errcode = '23503';
  end if;

  update public.sale_payments set due_on = p_new_due where id = p_cuota_id;

  insert into public.sale_payment_changes
    (sale_payment_id, old_due_on, new_due_on, changed_by, reason)
  values
    (p_cuota_id, old_due, p_new_due, p_by, p_reason);
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_payment(p_cuota_id uuid, p_by text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'voided_by is required' using errcode = '22023';
  end if;
  update public.sale_payments
  set status = 'void', voided_at = now(), void_reason = p_reason, voided_by = p_by
  where id = p_cuota_id and status = 'pending';
  if not found then
    raise exception 'installment % does not exist or is not pending', p_cuota_id using errcode = '23503';
  end if;
end;
$function$;

comment on table public.sale_payments is 'The payment plan: one row per installment expected. Pending means the obligation is live, not that it is unpaid; coverage is derived from payment_receipts.';
comment on table public.payment_receipts is 'Append-only evidence of money received against a planned installment. Paid and partial are derived: nothing is stored twice.';
comment on table public.sale_payment_changes is 'Every reschedule of an installment: from, to, when, who and why. The installment is the current state; this is the history.';
