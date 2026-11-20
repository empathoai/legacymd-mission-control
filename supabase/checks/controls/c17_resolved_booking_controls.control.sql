-- Control for C17: resolve a booking without its actor and the check must report it.
-- The biconditional is dropped to inject the bad state. Rolls back.
begin;

select public.resolve_customer('control resolved customer', null, null);

insert into public.appointments
  (customer_id, scheduled_at, expected_category_id, source_id, created_by)
select c.id, now() + interval '1 day', cat.id, s.id, 'control'
from public.customers c, public.categories cat, public.sources s
where c.normalized_name = 'control resolved customer'
  and cat.slug = 'aesthetics'
  and s.slug = 'instagram';

alter table public.appointments drop constraint resolved_has_actor;

update public.appointments
set status = 'show_up'
where created_by = 'control';

select id, status, resolved_at, resolved_on, resolved_by, cancel_reason
from public.appointments
where (status <> 'booked'
       and (resolved_at is null or resolved_on is null
            or resolved_by is null or length(btrim(resolved_by)) = 0))
   or (status = 'booked'
       and (resolved_at is not null or resolved_on is not null
            or resolved_by is not null or cancel_reason is not null))
   or (status = 'cancelled'
       and (cancel_reason is null or length(btrim(cancel_reason)) < 4))
   or (status in ('show_up', 'no_show') and cancel_reason is not null)
order by id;

rollback;
