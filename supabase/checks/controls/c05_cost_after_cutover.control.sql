-- Control for C05: a post-cutover line for an item with no cost interval must be reported.
-- Rolls back.
begin;

insert into public.treatments (name, normalized_name, price, code)
values ('control with no cost', 'control with no cost', 10, 'TRT-CONTROL');

insert into public.sales (occurred_on, customer_id, is_first_visit)
values (
  date '2026-11-20',
  (select id from public.customers order by id limit 1),
  false
);

insert into public.sale_items (sale_id, treatment_id, quantity, unit_price)
select s.id, t.id, 1, 10
from public.sales s, public.treatments t
where s.occurred_on = date '2026-11-20'
  and t.normalized_name = 'control with no cost'
order by s.created_at desc
limit 1;

select
  i.id,
  s.occurred_on,
  coalesce(t.name, p.name, sv.name, i.description) as item,
  i.treatment_id,
  i.product_id,
  i.service_id
from public.sale_items i
join public.sales s on s.id = i.sale_id
join public.sale_line_cost c on c.sale_item_id = i.id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id
where s.occurred_on >= date '2026-11-20'
  and c.unit_cost is null;

rollback;
