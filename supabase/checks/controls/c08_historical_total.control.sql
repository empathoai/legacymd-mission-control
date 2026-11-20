-- Control for C08: one extra peso in the historical window must be reported. Rolls back.
begin;

insert into public.sale_items (sale_id, description, quantity, unit_price)
select id, 'control: one extra peso', 1, 1
from public.sales
where occurred_on <= date '2026-11-19'
order by occurred_on
limit 1;

select
  round(coalesce(sum(i.line_total), 0), 2) as total,
  219492.91::numeric as expected
from public.sale_items i
join public.sales s on s.id = i.sale_id
where s.occurred_on <= date '2026-11-19'
having round(coalesce(sum(i.line_total), 0), 2) <> 219492.91::numeric;

rollback;
