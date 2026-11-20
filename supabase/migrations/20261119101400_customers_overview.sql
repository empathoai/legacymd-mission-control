-- 101400_customers_overview.sql
-- The customer list needs the master (name, phone) and the money (balance, last visit, next
-- due) in one query. customer_balances is money-driven and drops customers without a money
-- fact, so the join must start from customers and keep everyone.

create or replace view public.customers_overview with (security_invoker = true) as
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
  coalesce(b.pending_return_total, 0)::numeric(12,2) as pending_return_total
from public.customers c
left join public.customer_balances b on b.id = c.id;

comment on view public.customers_overview is
  'Every customer with her money summary. Includes the ones with no sale yet, at zero.';
