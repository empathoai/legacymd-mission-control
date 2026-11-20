-- 095400_control_columns.sql
-- The control columns, completed and centralized.
--
-- Where each one lives:
--   sales.voided_at / void_reason / voided_by     a sale that never happened (093700)
--   sale_payments.voided_at / void_reason / voided_by   a installment that will never be charged
--   sale_payment_changes                           every reschedule, with who and why (D3)
--   sale_refunds.state / refunded_at / recorded_by money that left, and who recorded it
--   payment_receipts.recorded_by                   append-only evidence, never voided
--   cost_calibrations.calibrated_by                every price-list correction
--
-- Two gaps closed here: a voided installment did not record who voided it, and rescheduling had
-- no audit at all. The functions below are the only supported way to do the three
-- operations, so the columns are always written together.

alter table public.sale_payments
  add column if not exists voided_by text;

alter table public.sale_payments drop constraint if exists void_has_reason;
alter table public.sale_payments
  add constraint void_has_reason check (
    (status = 'void') = (
      voided_at is not null and void_reason is not null and voided_by is not null
    )
  );

create table if not exists public.sale_payment_changes (
  id               uuid primary key default gen_random_uuid(),
  sale_payment_id  uuid not null references public.sale_payments(id) on delete restrict,
  old_due_on       date not null,
  new_due_on       date not null,
  changed_at       timestamptz not null default now(),
  changed_by       text not null,
  reason           text not null check (length(btrim(reason)) >= 4),
  constraint change_moves_the_date check (old_due_on <> new_due_on)
);

comment on table public.sale_payment_changes is
  'Every reschedule of a installment: from, to, when, who and why. The installment is the current state; this is the history.';

create index if not exists sale_payment_changes_installment_idx
  on public.sale_payment_changes (sale_payment_id, changed_at);

create or replace function public.guard_sale_payment() returns trigger
language plpgsql as $$
begin
  if new.status = 'void' and old.status <> 'void' then
    if exists (select 1 from public.payment_receipts where sale_payment_id = new.id) then
      raise exception 'a installment with receipts cannot be voided; record a return instead'
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
      raise exception 'a installment cannot be rescheduled into the past' using errcode = '23514';
    end if;
    if exists (select 1 from public.payment_receipts where sale_payment_id = new.id) then
      raise exception 'a installment with receipts cannot be rescheduled' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sale_payments_guard on public.sale_payments;
create trigger sale_payments_guard
  before update on public.sale_payments
  for each row execute function public.guard_sale_payment();

create or replace function public.void_sale(
  p_sale_id uuid,
  p_by      text,
  p_reason  text
) returns void
language plpgsql
as $$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'voided_by is required' using errcode = '22023';
  end if;
  update public.sales
  set voided_at = now(), void_reason = p_reason, voided_by = p_by
  where id = p_sale_id and voided_at is null;
  if not found then
    raise exception 'sale % does not exist or is already voided', p_sale_id using errcode = '23503';
  end if;
end;
$$;

create or replace function public.void_payment(
  p_installment_id uuid,
  p_by       text,
  p_reason   text
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
    raise exception 'installment % does not exist or is not pending', p_installment_id using errcode = '23503';
  end if;
end;
$$;

create or replace function public.reschedule_payment(
  p_installment_id uuid,
  p_new_due  date,
  p_by       text,
  p_reason   text
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
    raise exception 'installment % does not exist or is not pending', p_installment_id using errcode = '23503';
  end if;

  update public.sale_payments set due_on = p_new_due where id = p_installment_id;

  insert into public.sale_payment_changes
    (sale_payment_id, old_due_on, new_due_on, changed_by, reason)
  values
    (p_installment_id, old_due, p_new_due, p_by, p_reason);
end;
$$;

comment on function public.void_sale(uuid, text, text) is
  'Voids a sale with no money collected. The guard refuses a sale with receipts or returns.';
comment on function public.void_payment(uuid, text, text) is
  'Voids one pending installment and records who and why. The guard refuses a installment with receipts.';
comment on function public.reschedule_payment(uuid, date, text, text) is
  'Moves a pending installment to a new date and writes the audit row. Refuses a past date, a void installment or a installment with receipts.';
