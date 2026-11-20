-- C09: no receipt exists against an installment that was voided. The trigger already refuses to
-- record one, because a void installment expects nothing; this asserts the data agrees.
select
  r.id as receipt_id,
  r.sale_payment_id,
  r.amount,
  p.status
from public.payment_receipts r
join public.sale_payments p on p.id = r.sale_payment_id
where p.status = 'void'
order by r.id;
