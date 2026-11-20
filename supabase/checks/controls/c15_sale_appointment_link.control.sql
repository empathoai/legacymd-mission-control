-- Control for C15: a sale against another customer's booking must be reported.
-- The link trigger is disabled to inject the bad state. Rolls back.
begin;

select public.resolve_customer('control sale a', null, null);
select public.resolve_customer('control sale b', null, null);

insert into public.appointments
  (customer_id, scheduled_at, expected_category_id, source_id, created_by)
select c.id, now() + interval '1 day', cat.id, s.id, 'control'
from public.customers c, public.categories cat, public.sources s
where c.normalized_name = 'control sale b'
  and cat.slug = 'aesthetics'
  and s.slug = 'instagram';

alter table public.sales disable trigger sales_link_appointment;

insert into public.sales (customer_id, occurred_on, is_first_visit, appointment_id)
select c.id, date '2026-11-19', false,
       (select id from public.appointments where created_by = 'control' order by created_at desc limit 1)
from public.customers c
where c.normalized_name = 'control sale a';

select
  s.id as sale_id,
  s.appointment_id,
  a.customer_id as booking_customer,
  s.customer_id as sale_customer,
  a.status
from public.sales s
join public.appointments a on a.id = s.appointment_id
where s.voided_at is null
  and (a.customer_id <> s.customer_id or a.status <> 'show_up')
order by s.id;

rollback;
