-- 20261120130100_sale_money.sql
-- What one sale sold, what came in, what went back. The returns screen needs the
-- three numbers side by side, and the patient detail already computes them by hand.
--
-- Reads only: every column comes from rows the write layer owns. Nothing here can
-- move money.

create index if not exists sale_refunds_state_idx on public.sale_refunds (state);

create or replace view public.sale_money with (security_invoker = true) as
select
  s.id                                            as sale_id,
  s.occurred_on,
  s.customer_id,
  (s.voided_at is not null)                       as voided,
  coalesce(t.total, 0)::numeric(12,2)             as total,
  coalesce(r.collected, 0)::numeric(12,2)         as collected,
  coalesce(f.returned, 0)::numeric(12,2)          as returned,
  coalesce(f.pending, 0)::numeric(12,2)           as pending_return,
  (coalesce(t.total, 0) - coalesce(r.collected, 0))::numeric(12,2) as balance
from public.sales s
left join (
  select sale_id, sum(line_total) as total
  from public.sale_items
  group by sale_id
) t on t.sale_id = s.id
left join (
  select p.sale_id, sum(rc.amount) as collected
  from public.payment_receipts rc
  join public.sale_payments p on p.id = rc.sale_payment_id
  group by p.sale_id
) r on r.sale_id = s.id
left join (
  select sale_id,
         sum(amount) filter (where state = 'refunded') as returned,
         sum(amount) filter (where state = 'pending')  as pending
  from public.sale_refunds
  group by sale_id
) f on f.sale_id = s.id;

comment on view public.sale_money is
  'One row per sale: sold, collected, returned and the balance. A return reduces the balance; a void is flagged.';
