-- 100400_appointment_views.sql
-- Attendance, conversion and the balance view narrowed to customers with money.

create or replace view public.appointment_funnel with (security_invoker = true) as
select
  date_trunc('week', scheduled_on)::date                                    as week_start,
  count(*)                                                                  as bookings,
  count(*) filter (where status = 'show_up')                                as show_ups,
  count(*) filter (where status = 'no_show')                                as no_shows,
  count(*) filter (where status = 'cancelled')                              as cancelled,
  count(*) filter (where status = 'booked')                                 as unresolved,
  round(100.0 * count(*) filter (where status = 'show_up')
        / nullif(count(*) filter (where status in ('show_up', 'no_show')), 0), 1)
                                                                            as show_up_rate
from public.appointments
group by 1;

comment on view public.appointment_funnel is
  'Weekly attendance. show_up_rate is null when a week has no resolved bookings; cancelled and booked never enter it.';

create or replace view public.appointment_conversion with (security_invoker = true) as
select
  date_trunc('month', first_show_on)::date as month,
  count(*)                                 as conversions
from (
  select customer_id, min(scheduled_on) as first_show_on
  from public.appointments
  where status = 'show_up'
  group by customer_id
) first_show
group by 1;

comment on view public.appointment_conversion is
  'Conversions per month: the first show-up of each customer. LTV is customer_balances.sold_total.';

create or replace view public.customer_balances with (security_invoker = true) as
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
  select a.customer_id,
         sum(a.revenue_delta) as revenue_delta,
         sum(a.cash_delta) as cash_delta
  from public.adjustments a
  where a.customer_id is not null
  group by a.customer_id
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
    and p.amount > coalesce((select sum(r.amount) from public.payment_receipts r
                             where r.sale_payment_id = p.id), 0)
  group by s.customer_id
)
select
  c.id,
  c.full_name,
  coalesce(sd.sold, 0)::numeric(12,2)          as sold_total,
  coalesce(co.collected, 0)::numeric(12,2)     as collected_total,
  coalesce(ad.revenue_delta, 0)::numeric(12,2) as adjustment_revenue_total,
  coalesce(ad.cash_delta, 0)::numeric(12,2)    as adjustment_cash_total,
  coalesce(ob.pending_return, 0)::numeric(12,2) as pending_return_total,
  (coalesce(sd.sold, 0) + coalesce(ad.revenue_delta, 0) - coalesce(ad.cash_delta, 0)
     - coalesce(co.collected, 0) - coalesce(ob.pending_return, 0))::numeric(12,2) as balance,
  coalesce(sd.visits, 0)                       as visits,
  sd.last_visit_on,
  nd.next_due_on,
  (coalesce(sd.sold, 0) + coalesce(ad.revenue_delta, 0) - coalesce(ad.cash_delta, 0)
     - coalesce(co.collected, 0) - coalesce(ob.pending_return, 0)) <= 0 as is_settled,
  exists (
    select 1
    from public.sale_payments p
    join public.sales s on s.id = p.sale_id
    where s.customer_id = c.id
      and p.status = 'pending'
      and p.due_on < current_date
      and p.amount > coalesce((select sum(r.amount) from public.payment_receipts r
                               where r.sale_payment_id = p.id), 0)
  )                                            as is_overdue
from public.customers c
left join sold sd on sd.customer_id = c.id
left join collected co on co.customer_id = c.id
left join adjusted ad on ad.customer_id = c.id
left join owed_back ob on ob.customer_id = c.id
left join next_due nd on nd.customer_id = c.id
where sd.customer_id is not null
   or co.customer_id is not null
   or ad.customer_id is not null
   or ob.customer_id is not null;

comment on view public.customer_balances is
  'Balance per customer with at least one money fact. A booking without a sale never appears here.';
