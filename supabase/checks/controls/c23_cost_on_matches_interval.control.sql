-- Control for C23: put the old definition back inside the transaction and prove the check
-- sees the 56 rows it used to answer wrong. Rolls back.
begin;

create or replace function public.cost_on(
  p_kind text,
  p_item_id uuid,
  p_on date
)
returns numeric
language sql
stable
as $fn$
  select public.cost_at(p_kind, p_item_id, p_on::timestamptz)
$fn$;

select h.item_kind,
       h.item_id,
       h.effective_from::date as day,
       h.cost,
       public.cost_on(h.item_kind, h.item_id, h.effective_from::date) as answered
from public.item_cost_history h
where (h.effective_from at time zone 'America/New_York')::time = time '00:00:00'
  and public.cost_on(h.item_kind, h.item_id, h.effective_from::date) is distinct from h.cost
order by h.item_kind, h.item_id, day;

rollback;
