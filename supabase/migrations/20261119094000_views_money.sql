-- 094000_views_money.sql
-- The balance and the two cash lanes, rebuilt on receipts, returns and adjustments.
-- cash_forecast stays as a compatibility view because the lock-down file enumerates it;
-- new code reads cash_expected and cash_collected.

create view public.customer_balances with (security_invoker = true) as
with sold as (
  select s.customer_id,
         sum(i.line_total) as sold,
         count(distinct s.id) as visits,
         max(s.occurred_on) as last_visit_on
  from public.sales s
  join public.sale_items i on i.sale_id = s.id
  where s.voided_at is null
  group by s.customer_id
), collected as (
  select s.customer_id, sum(r.amount) as collected
  from public.payment_receipts r
  join public.sale_payments p on p.id = r.sale_payment_id
  join public.sales s on s.id = p.sale_id
  where s.voided_at is null
  group by s.customer_id
), adjusted as (
  select customer_id,
         sum(revenue_delta) as revenue_delta,
         sum(cash_delta) as cash_delta
  from public.adjustments
  where customer_id is not null
  group by customer_id
), owed_back as (
  select s.customer_id, sum(r.amount) as pending_return
  from public.sale_refunds r
  join public.sales s on s.id = r.sale_id
  where r.state = 'pending'
  group by s.customer_id
), next_due as (
  select s.customer_id, min(p.due_on) as next_due_on
  from public.sale_payments p
  join public.sales s on s.id = p.sale_id
  where p.status = 'pending'
    and p.due_on >= current_date
    and p.amount > coalesce((
      select sum(r.amount) from public.payment_receipts r
      where r.sale_payment_id = p.id
    ), 0)
  group by s.customer_id
)
select
  c.id,
  c.full_name,
  coalesce(sd.sold, 0)::numeric(12,2)                       as sold_total,
  coalesce(co.collected, 0)::numeric(12,2)                  as collected_total,
  coalesce(ad.revenue_delta, 0)::numeric(12,2)              as adjustment_revenue_total,
  coalesce(ad.cash_delta, 0)::numeric(12,2)                 as adjustment_cash_total,
  coalesce(ob.pending_return, 0)::numeric(12,2)             as pending_return_total,
  (coalesce(sd.sold, 0)
    + coalesce(ad.revenue_delta, 0)
    - coalesce(ad.cash_delta, 0)
    - coalesce(co.collected, 0)
    - coalesce(ob.pending_return, 0))::numeric(12,2)        as balance,
  coalesce(sd.visits, 0)                                    as visits,
  sd.last_visit_on,
  nd.next_due_on,
  (coalesce(sd.sold, 0)
    + coalesce(ad.revenue_delta, 0)
    - coalesce(ad.cash_delta, 0)
    - coalesce(co.collected, 0)
    - coalesce(ob.pending_return, 0)) <= 0                  as is_settled,
  exists (
    select 1
    from public.sale_payments p
    join public.sales s on s.id = p.sale_id
    where s.customer_id = c.id
      and p.status = 'pending'
      and p.due_on < current_date
      and p.amount > coalesce((
        select sum(r.amount) from public.payment_receipts r
        where r.sale_payment_id = p.id
      ), 0)
  )                                                         as is_overdue
from public.customers c
left join sold sd on sd.customer_id = c.id
left join collected co on co.customer_id = c.id
left join adjusted ad on ad.customer_id = c.id
left join owed_back ob on ob.customer_id = c.id
left join next_due nd on nd.customer_id = c.id;

comment on view public.customer_balances is
  'Per customer: sold, collected, adjustments, money owed back, and the balance as sold + adjustments(revenue - cash) - collected - pending returns. Voided sales are excluded.';

create view public.cash_expected with (security_invoker = true) as
select
  date_trunc('month', p.due_on)::date as month,
  sum(p.amount - coalesce(r.paid, 0))::numeric(12,2) as expected,
  sum(case when p.due_on < current_date then p.amount - coalesce(r.paid, 0) else 0 end)::numeric(12,2) as overdue
from public.sale_payments p
join public.sales s on s.id = p.sale_id and s.voided_at is null
left join (
  select sale_payment_id, sum(amount) as paid
  from public.payment_receipts
  group by sale_payment_id
) r on r.sale_payment_id = p.id
where p.status = 'pending'
group by 1
having sum(p.amount - coalesce(r.paid, 0)) > 0
order by 1;

comment on view public.cash_expected is
  'What is still expected per month of due date, minus what was already received. Overdue is the part already past due.';

create view public.cash_collected with (security_invoker = true) as
select
  date_trunc('month', received_on)::date as month,
  sum(amount)::numeric(12,2) as collected
from public.payment_receipts
group by 1
order by 1;

comment on view public.cash_collected is
  'Money received per month of bank date. This is the lane that reconciles against the bank.';

create view public.cash_forecast with (security_invoker = true) as
select
  coalesce(e.month, c.month)                as month,
  coalesce(e.expected, 0)::numeric(12,2)    as expected,
  coalesce(c.collected, 0)::numeric(12,2)   as received
from public.cash_expected e
full join public.cash_collected c on c.month = e.month
order by 1;

comment on view public.cash_forecast is
  'Compatibility view: expected by due date and received by bank date, never summed. Use cash_expected and cash_collected.';
