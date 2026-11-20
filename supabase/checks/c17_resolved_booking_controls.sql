-- C17: a resolved booking carries its actor, moment and local day; a live one carries none.
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
