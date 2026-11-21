-- 20261121250000_session_progress_by_program.sql
-- `session_progress` joined the sale line to its own row, so it only saw the row that sold.
-- Semaglutide's 13 lines hang on the retired unit `TRT-0037`, so the active package
-- `PCK-0015` looked empty — a patient's history split by a row nobody chose.
--
-- A weight-loss program is one program with a name; the pair (package now, unit once, or the
-- reverse) is the same thing to the clinic and to the patient. The view now groups the
-- history by the item's name and reports the active row's code, so a rename or a row swap
-- does not lose a patient.
--
-- `session_gaps` follows, because it reads this view.

create or replace view public.session_progress
with (security_invoker = true) as
with program as (
  select t.name,
         min(t.code) filter (where t.active) as item_code,
         max(t.sessions_minimum) as sessions_minimum
  from public.treatments t
  where t.sessions_minimum is not null
  group by t.name
)
select p.item_code,
       p.name as item_name,
       p.sessions_minimum,
       c.id as customer_id,
       c.full_name as customer_name,
       count(si.id) as sessions_taken,
       round(sum(si.line_total), 2) as paid,
       round(sum(si.line_total) / count(si.id), 2) as value_per_session,
       min(s.occurred_on) as first_on,
       max(s.occurred_on) as last_on,
       case
         when count(si.id) >= p.sessions_minimum then 'complete'
         else 'incomplete'
       end as state
from public.sale_items si
join public.sales s on s.id = si.sale_id
join public.treatments t on t.id = si.treatment_id
join program p on p.name = t.name
join public.customers c on c.id = s.customer_id
where s.voided_at is null
group by p.item_code, p.name, p.sessions_minimum, c.id, c.full_name;

create or replace view public.session_gaps
with (security_invoker = true) as
select *
from public.session_progress
where state = 'incomplete';

do $$
declare
  v_items int;
begin
  select count(distinct item_code) into v_items from public.session_progress;
  if v_items <> 2 then
    raise exception 'C: expected the two weight-loss programs, found %', v_items;
  end if;
end $$;
