-- 20261121210000_drop_duration_months.sql
-- The owner settled what a package's number means: those are **sessions**, not months, and
-- they are not decided by the catalog — a patient can take 12, or fewer, depending on
-- progress. So the count belongs to the patient's plan, not to the item, and a column on
-- `treatments` can only hold a number that is wrong for someone.
--
-- Nothing reads it: no view, no function, no screen (`information_schema.view_column_usage`
-- and every `pg_proc.prosrc` are clean), and the four values in the base came from the
-- installment arithmetic (1980 ÷ 495), not from a session count. Dropping it removes a
-- label that could only mislead; the money side is untouched, because the forecast reads
-- `sale_payments.due_on` and `payment_receipts`.
--
-- If the clinic wants to record how many sessions a patient has left, that is a field on
-- the plan or the sale, designed with the desk — not a default on the catalog item.

alter table public.treatments
  drop constraint if exists treatments_duration_positive;

alter table public.treatments
  drop column if exists duration_months;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'treatments'
      and column_name = 'duration_months'
  ) then
    raise exception 'C: duration_months is still there';
  end if;

  if exists (
    select 1 from public.treatments where unit_type = 'package' and not active
  ) then
    null;  -- packages may be retired; nothing to check beyond the column
  end if;

  raise notice 'duration_months dropped: sessions belong to the patient, not the item';
end $$;
