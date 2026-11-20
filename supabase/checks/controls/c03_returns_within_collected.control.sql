-- Control for C03: a return above what was collected must be reported. The trigger that
-- would refuse it is disabled inside the transaction. Rolls back.
begin;

alter table public.sale_refunds disable trigger sale_refunds_within_collected;

insert into public.sale_refunds
  (sale_id, amount, refunded_on, method_id, kind, state, refunded_at, reason, recorded_by)
select s.id,
       (select coalesce(sum(rc.amount), 0)
          from public.payment_receipts rc
          join public.sale_payments p on p.id = rc.sale_payment_id
         where p.sale_id = s.id) + 1,
       date '2026-11-19',
       (select id from public.payment_methods where slug = 'unspecified'),
       'refund', 'refunded', date '2026-11-19',
       'control: more than collected', 'control'
from public.sales s
where exists (
  select 1 from public.payment_receipts rc
  join public.sale_payments p on p.id = rc.sale_payment_id
  where p.sale_id = s.id
)
order by s.id
limit 1;

select
  s.id as sale_id,
  (select coalesce(sum(r.amount), 0) from public.sale_refunds r where r.sale_id = s.id)::numeric(12,2) as returned,
  (select coalesce(sum(rc.amount), 0)
     from public.payment_receipts rc
     join public.sale_payments p on p.id = rc.sale_payment_id
    where p.sale_id = s.id)::numeric(12,2) as collected
from public.sales s
where (select coalesce(sum(r.amount), 0) from public.sale_refunds r where r.sale_id = s.id)
    > (select coalesce(sum(rc.amount), 0)
         from public.payment_receipts rc
         join public.sale_payments p on p.id = rc.sale_payment_id
        where p.sale_id = s.id);

rollback;
