-- C14: every reschedule chain ends at the current slot and has no gaps.
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
