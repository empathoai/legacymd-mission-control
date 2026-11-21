-- 20261121240000_minimum_sessions.sql
-- The owner's rule for the weight-loss programs: a **minimum of four sessions**, and nothing
-- in this system is worth zero.
--
-- 1. `treatments.sessions_minimum` says how many sessions an item includes at a minimum. It
--    is null on the rest of the catalog, so the rule only applies where the clinic set it.
-- 2. The value of a program is segregated from what was paid, per session, without touching
--    a sale: `session_progress` reads it, `session_gaps` lists the patients below the minimum.
--    A patient above the minimum is complete or continuing — extra sessions are their own
--    charge, not an error. A patient below it is the case the clinic has to answer.
-- 3. Zero is refused at the write: a line needs a price above zero and a total above zero.
--    Payments and receipts already had this rule; the sale line did not.

do $$
declare
  v_rows int;
begin
  alter table public.treatments
    add column if not exists sessions_minimum smallint;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.treatments'::regclass
      and conname = 'treatments_sessions_minimum_positive'
  ) then
    alter table public.treatments
      add constraint treatments_sessions_minimum_positive
      check (sessions_minimum is null or sessions_minimum >= 1);
  end if;

  comment on column public.treatments.sessions_minimum is
    'Sessions an item includes at a minimum. Null means the item has no session program. A patient may take more; those are separate charges.';

  update public.treatments
  set sessions_minimum = 4
  where code in ('PCK-0016', 'PCK-0015')
    and sessions_minimum is distinct from 4;
  get diagnostics v_rows = row_count;
  if v_rows <> 2 then
    raise exception 'C: expected two weight-loss packages to carry four sessions, updated %', v_rows;
  end if;

  -- A line is worth something.
  alter table public.sale_items drop constraint if exists sale_items_unit_price_check;
  alter table public.sale_items
    add constraint sale_items_unit_price_positive check (unit_price > 0);

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sale_items'::regclass
      and conname = 'sale_items_line_total_positive'
  ) then
    alter table public.sale_items
      add constraint sale_items_line_total_positive
      check (line_total is not null and line_total > 0);
  end if;
end $$;

create or replace view public.session_progress
with (security_invoker = true) as
select t.code as item_code,
       t.name as item_name,
       t.sessions_minimum,
       c.id as customer_id,
       c.full_name as customer_name,
       count(si.id) as sessions_taken,
       round(sum(si.line_total), 2) as paid,
       round(sum(si.line_total) / count(si.id), 2) as value_per_session,
       min(s.occurred_on) as first_on,
       max(s.occurred_on) as last_on,
       case
         when count(si.id) >= t.sessions_minimum then 'complete'
         else 'incomplete'
       end as state
from public.sale_items si
join public.sales s on s.id = si.sale_id
join public.treatments t on t.id = si.treatment_id
join public.customers c on c.id = s.customer_id
where t.sessions_minimum is not null
  and s.voided_at is null
group by t.code, t.name, t.sessions_minimum, c.id, c.full_name;

create or replace view public.session_gaps
with (security_invoker = true) as
select *
from public.session_progress
where state = 'incomplete';

do $$
declare
  v_packages int;
  v_complete int;
  v_gaps int;
begin
  select count(*) into v_packages
  from public.treatments where sessions_minimum is not null;
  if v_packages <> 2 then
    raise exception 'C: expected two items with a session minimum, found %', v_packages;
  end if;

  select count(*) filter (where state = 'complete'),
         count(*) filter (where state = 'incomplete')
  into v_complete, v_gaps
  from public.session_progress;

  raise notice 'session programme: % patients complete, % below the minimum', v_complete, v_gaps;
end $$;
