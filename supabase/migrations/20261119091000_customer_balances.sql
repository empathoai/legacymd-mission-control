-- 20261119091000_customer_balances.sql
-- Per-customer cash position, derived from the payment schedule.
-- Nothing is stored: a balance cannot drift from the payments it comes from.

-- 89 rows in the source workbook carry no payment method at all. They import as
-- this method rather than as null, so "no method" is visible instead of silent.
insert into public.payment_methods (slug, label, sort_order)
values ('unspecified', 'Unspecified', 99)
on conflict (slug) do nothing;

create or replace view public.customer_balances as
with money as (
  select
    s.customer_id,
    coalesce(sum(p.amount) filter (where p.status = 'paid'), 0)    as paid,
    coalesce(sum(p.amount) filter (where p.status = 'pending'), 0) as pending,
    min(p.due_on) filter (where p.status = 'pending')              as next_due_on
  from public.sales s
  join public.sale_payments p on p.sale_id = s.id
  where p.status <> 'void'
  group by s.customer_id
)
select
  c.id,
  c.full_name,
  coalesce(m.paid, 0)::numeric(12,2)    as paid_total,
  coalesce(m.pending, 0)::numeric(12,2) as pending_total,
  m.next_due_on,
  (coalesce(m.pending, 0) = 0)          as is_settled,
  (m.next_due_on is not null and m.next_due_on < current_date and m.pending > 0) as is_overdue
from public.customers c
left join money m on m.customer_id = c.id;

comment on view public.customer_balances is 'Paid vs pending per customer, plus next due date and overdue flag.';
