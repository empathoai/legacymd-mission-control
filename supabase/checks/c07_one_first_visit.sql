-- C07: a customer has at most one sale flagged as their first visit.
-- A second flagged sale means a repeat patient is being counted as new.
select
  s.customer_id,
  c.full_name,
  count(*) as first_visits
from public.sales s
join public.customers c on c.id = s.customer_id
where s.is_first_visit
group by s.customer_id, c.full_name
having count(*) > 1
order by count(*) desc, c.full_name;
