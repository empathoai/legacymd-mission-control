-- Control for C22: bypass the date triggers and insert a sale dated 2099; the check must see
-- it. Everything rolls back.
begin;

alter table public.sales disable trigger sales_dates;

insert into public.sales
  (occurred_on, customer_id, is_first_visit, visit_number, billed_at, billed_at_source)
select date '2099-01-01', id, false, null, now(), 'live'
from public.customers
order by id
limit 1;

select 'sale' as what, s.id::text as id, s.occurred_on::text as day
from public.sales s
where s.occurred_on > current_date
   or (s.billed_at is not null
       and (s.billed_at at time zone 'America/New_York')::date < s.occurred_on)
union all
select 'installment', p.id::text, p.due_on::text
from public.sale_payments p
join public.sales s on s.id = p.sale_id
where p.due_on < s.occurred_on
union all
select 'receipt', r.id::text, r.received_on::text
from public.payment_receipts r
join public.sale_payments p on p.id = r.sale_payment_id
join public.sales s on s.id = p.sale_id
where r.received_on > current_date
   or r.received_on < s.occurred_on
union all
select 'return', f.id::text, f.refunded_on::text
from public.sale_refunds f
join public.sales s on s.id = f.sale_id
where f.refunded_on > current_date
   or f.refunded_on < s.occurred_on
   or (f.state = 'refunded'
       and f.refunded_at is not null
       and (f.refunded_at::date < f.refunded_on or f.refunded_at::date > current_date));

rollback;
