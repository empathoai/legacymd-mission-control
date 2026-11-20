-- Control for C06: a line whose list price disagrees with the price history must be
-- reported. Rolls back.
begin;

insert into public.sales (occurred_on, customer_id, is_first_visit)
values (
  date '2026-11-20',
  (select id from public.customers order by id limit 1),
  false
);

insert into public.sale_items (sale_id, treatment_id, quantity, unit_price, list_price)
select s.id, t.id, 1, t.price, t.price + 100
from public.sales s, public.treatments t
where s.occurred_on = date '2026-11-20'
  and t.price is not null
  and t.active
order by s.created_at desc, t.id
limit 1;

select
  i.id,
  s.occurred_on,
  i.list_price,
  h.price as history_price
from public.sale_items i
join public.sales s on s.id = i.sale_id
join lateral (
  select h.price
  from public.item_price_history h
  where h.item_kind = 'treatment'
    and h.item_id = i.treatment_id
    and h.effective_from <= s.occurred_on
  order by h.effective_from desc
  limit 1
) h on true
where s.occurred_on >= date '2026-11-20'
  and i.treatment_id is not null
  and (i.list_price is null or i.list_price is distinct from h.price);

rollback;
