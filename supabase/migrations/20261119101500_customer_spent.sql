-- 101500_customer_spent.sql
-- "How much has this patient spent here" is lifetime revenue minus the money returned to her,
-- pending or already paid. The column is added to the overview so the list can show it.

create or replace view public.customers_overview with (security_invoker = true) as
with refunds as (
  select s.customer_id, sum(r.amount) as v
  from public.sale_refunds r
  join public.sales s on s.id = r.sale_id
  group by s.customer_id
)
select
  c.id,
  c.full_name,
  c.normalized_name,
  c.phone,
  c.created_at,
  coalesce(b.sold_total, 0)::numeric(12,2)          as sold_total,
  coalesce(b.balance, 0)::numeric(12,2)             as balance,
  coalesce(b.visits, 0)                             as visits,
  b.last_visit_on,
  b.next_due_on,
  coalesce(b.is_overdue, false)                     as is_overdue,
  coalesce(b.is_settled, true)                      as is_settled,
  coalesce(b.pending_return_total, 0)::numeric(12,2) as pending_return_total,
  coalesce(rf.v, 0)::numeric(12,2)                  as refunded_total,
  (coalesce(b.sold_total, 0) - coalesce(rf.v, 0))::numeric(12,2) as spent_total
from public.customers c
left join public.customer_balances b on b.id = c.id
left join refunds rf on rf.customer_id = c.id;

comment on column public.customers_overview.spent_total is
  'Lifetime revenue minus every return, paid or pending: what the patient really paid.';
