-- C23: cost_on(date) must answer the cost of the interval that starts that day.
-- The intervals start at midnight America/New_York, which is 05:00 UTC. `cost_on` resolved
-- the date at 00:00 UTC, so it landed in the interval before — or nowhere.
--
-- Only intervals that start at the clinic's midnight are asked by date: three rows start
-- mid-morning (a migration used now()) and correctly answer the cost in force before them.
select h.item_kind,
       h.item_id,
       h.effective_from::date as day,
       h.cost,
       public.cost_on(h.item_kind, h.item_id, h.effective_from::date) as answered
from public.item_cost_history h
where (h.effective_from at time zone 'America/New_York')::time = time '00:00:00'
  and public.cost_on(h.item_kind, h.item_id, h.effective_from::date) is distinct from h.cost
order by h.item_kind, h.item_id, day;
