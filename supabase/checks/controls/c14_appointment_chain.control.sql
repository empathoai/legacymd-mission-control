-- Control for C14: move a booking without its audit row and the chain must be reported.
-- Rolls back.
begin;

select public.resolve_customer('control chain customer', null, null);

insert into public.appointments
  (customer_id, scheduled_at, expected_category_id, source_id, created_by)
select c.id, now() + interval '1 day', cat.id, s.id, 'control'
from public.customers c, public.categories cat, public.sources s
where c.normalized_name = 'control chain customer'
  and cat.slug = 'aesthetics'
  and s.slug = 'instagram';

select public.reschedule_appointment(
  (select id from public.appointments where created_by = 'control' order by created_at desc limit 1),
  now() + interval '2 days', 'control', 'control reschedule');

alter table public.appointments disable trigger appointments_guard;

update public.appointments
set scheduled_at = now() + interval '5 days'
where created_by = 'control';

with chain as (
  select appointment_id, id, changed_at, old_scheduled_at, new_scheduled_at,
         lag(new_scheduled_at) over (partition by appointment_id order by changed_at, id)
           as previous_new
  from public.appointment_changes
), gap as (
  select appointment_id, 'chain gap: old slot differs from the previous new slot' as problem
  from chain
  where previous_new is not null and old_scheduled_at <> previous_new
), latest as (
  select distinct on (appointment_id) appointment_id, new_scheduled_at
  from public.appointment_changes
  order by appointment_id, changed_at desc, id desc
), stale as (
  select a.id as appointment_id, 'current slot differs from the last audit row' as problem
  from public.appointments a
  join latest l on l.appointment_id = a.id
  where l.new_scheduled_at <> a.scheduled_at
)
select appointment_id, problem from gap
union all
select appointment_id, problem from stale
order by 1;

rollback;
