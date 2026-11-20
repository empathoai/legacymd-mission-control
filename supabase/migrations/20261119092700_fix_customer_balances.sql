-- 20261119092700_fix_customer_balances.sql
-- The old view decided "settled" from pending = 0, without ever comparing what
-- was sold against what was paid. Since every historical payment imported as
-- paid, pending was always 0 and all 188 customers read as settled, including
-- the 12 who never bought anything (paid_total = 0).
--
-- A balance is sold - paid. Pending is a schedule detail (what is still to be
-- charged), not the balance itself: a sale can be pending and partly paid.
--
-- Adjustments (refunds, no-show fees) are not modelled yet. A refund that already
-- moved cash lowers revenue and cash by the same amount, so it will not change
-- this balance; an adjustment still pending would.

drop view if exists public.customer_balances;

create view public.customer_balances as
with sold as (
  select
    s.customer_id,
    sum(i.line_total)          as sold,
    count(distinct s.id)       as visits,
    max(s.occurred_on)         as last_visit_on
  from public.sales s
  join public.sale_items i on i.sale_id = s.id
  group by s.customer_id
), money as (
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
  coalesce(sd.sold, 0)::numeric(12,2)                          as sold_total,
  coalesce(m.paid, 0)::numeric(12,2)                           as paid_total,
  (coalesce(sd.sold, 0) - coalesce(m.paid, 0))::numeric(12,2)  as balance,
  coalesce(m.pending, 0)::numeric(12,2)                        as pending_total,
  m.next_due_on,
  coalesce(sd.visits, 0)                                       as visits,
  sd.last_visit_on,
  (coalesce(sd.sold, 0) - coalesce(m.paid, 0)) <= 0            as is_settled,
  (m.next_due_on is not null and m.next_due_on < current_date) as is_overdue
from public.customers c
left join sold sd on sd.customer_id = c.id
left join money m on m.customer_id = c.id;

comment on view public.customer_balances is
  'Per customer: sold, paid, balance (sold - paid, positive means owed), pending schedule, next due date, visits and last visit. is_overdue means a pending payment is past its due date. Customers with no visits have all zeros and count as settled: nothing is owed.';

comment on column public.customer_balances.balance is
  'sold_total - paid_total. Positive means the customer owes money. Does not include refunds or no-show fees yet.';
