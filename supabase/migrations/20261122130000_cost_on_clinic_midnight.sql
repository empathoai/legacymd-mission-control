-- 20261122130000_cost_on_clinic_midnight.sql
-- The review's fourth data finding: `cost_on(date)` cast the date to `timestamptz`, which
-- resolves at 00:00 UTC, while every cost interval starts at midnight America/New_York
-- (05:00 UTC). Asking for the day an interval started answered the interval before it, or
-- nothing: 56 of the 137 rows. No money view reads `cost_on` (margin goes through
-- `cost_at(billed_at)`), but the reporting scripts and any API consumer do.
--
-- The date now resolves at the clinic's midnight, the same convention the intervals use.

create or replace function public.cost_on(
  p_kind text,
  p_item_id uuid,
  p_on date
)
returns numeric
language sql
stable
as $fn$
  select public.cost_at(
    p_kind,
    p_item_id,
    (p_on::timestamp at time zone 'America/New_York')
  )
$fn$;

do $$
declare
  v_wrong int;
begin
  -- Only the intervals that start at the clinic's midnight can be asked by date; three rows
  -- start mid-morning (a migration used now()) and correctly answer the earlier cost.
  select count(*) into v_wrong
  from public.item_cost_history h
  where (h.effective_from at time zone 'America/New_York')::time = time '00:00:00'
    and public.cost_on(h.item_kind, h.item_id, h.effective_from::date) is distinct from h.cost;

  if v_wrong > 0 then
    raise exception 'C: cost_on still answers the wrong cost on % midnight intervals', v_wrong;
  end if;

  raise notice 'cost_on resolves the clinic midnight';
end $$;
