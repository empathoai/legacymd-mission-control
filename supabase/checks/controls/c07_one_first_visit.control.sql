-- Control for C07: a second first visit must be reported. Rolls back.
begin;

insert into public.sales (occurred_on, customer_id, is_first_visit)
select date '2026-11-20', customer_id, true
from public.sales
where is_first_visit
order by customer_id
limit 1;

select
  s.customer_id,
  c.full_name,
  count(*) as first_visits
from public.sales s
join public.customers c on c.id = s.customer_id
where s.is_first_visit
group by s.customer_id, c.full_name
having count(*) > 1;

rollback;
