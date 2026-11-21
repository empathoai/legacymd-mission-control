-- 20261122115000_return_settle_date_utc.sql
-- The guard added a minute ago compared `refunded_at` in New York time, but every writer
-- stores the settlement as a bare date cast to timestamptz, which lands at 00:00 UTC — 19:00
-- of the previous day in New York. So a return registered and settled on the same day was
-- rejected as "settled the day before". The comparison now uses the UTC date of the stored
-- moment, which is the date the caller passed.
--
-- `billed_at` keeps the New York comparison: that column is a real moment (`now()`), not a
-- date in disguise.

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
    if new.refunded_at::date < new.refunded_on then
      raise exception 'a return cannot be settled (%) before it was registered (%)',
        new.refunded_at::date, new.refunded_on
        using errcode = '23514';
    end if;
    if new.refunded_at::date > current_date then
      raise exception 'a return cannot be settled in the future (%)', new.refunded_at::date
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$fn$;

do $$
begin
  if pg_get_functiondef('public.guard_return_dates()'::regprocedure) ilike '%America/New_York%' then
    raise exception 'C: the return guard still compares in New York time';
  end if;
  raise notice 'the return guard compares the stored date';
end $$;
