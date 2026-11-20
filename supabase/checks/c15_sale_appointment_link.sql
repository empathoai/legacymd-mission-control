-- C15: a sale only points at a booking of the same customer that ended in show_up.
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
