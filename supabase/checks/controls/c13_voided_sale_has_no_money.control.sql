-- Control for C13: a voided sale carrying a receipt must be reported. The void guard is
-- skipped by inserting the void directly; the receipt cap is disabled. Rolls back.
begin;

insert into public.sales
  (occurred_on, customer_id, is_first_visit, voided_at, void_reason, voided_by)
values (
  date '2026-11-20',
  (select id from public.customers order by id limit 1),
  false, now(), 'control: voided after money', 'control'
);

insert into public.sale_payments (sale_id, method_id, due_on, amount, status)
select s.id, pm.id, date '2026-11-20', 10, 'pending'
from public.sales s, public.payment_methods pm
where s.voided_at is not null and pm.slug = 'unspecified'
order by s.created_at desc
limit 1;

alter table public.payment_receipts disable trigger payment_receipts_within_expected;

insert into public.payment_receipts
  (sale_payment_id, amount, received_on, method_id, source, recorded_by, note)
select p.id, 10, date '2026-11-20', p.method_id, 'manual', 'control',
       'control: money on a voided sale'
from public.sale_payments p
join public.sales s on s.id = p.sale_id
where s.voided_at is not null
order by p.created_at desc
limit 1;

select
  s.id as sale_id,
  s.voided_at,
  exists (
    select 1 from public.payment_receipts r
    join public.sale_payments p on p.id = r.sale_payment_id
    where p.sale_id = s.id
  ) as has_receipts,
  exists (select 1 from public.sale_refunds f where f.sale_id = s.id) as has_returns
from public.sales s
where s.voided_at is not null
  and (
    exists (
      select 1 from public.payment_receipts r
      join public.sale_payments p on p.id = r.sale_payment_id
      where p.sale_id = s.id
    )
    or exists (select 1 from public.sale_refunds f where f.sale_id = s.id)
  );

rollback;
