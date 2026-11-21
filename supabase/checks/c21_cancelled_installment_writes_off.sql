-- C21: a cancelled installment must have written off exactly what it still expected.
-- The write-off is one `adjustments` row of kind 'write_off' whose reason starts with
-- 'cancelled installment <id>'; C01 reads its negative revenue_delta as the forgiven amount.
select p.id,
       p.sale_id,
       p.amount,
       coalesce(sum(distinct r.amount), 0) as collected,
       coalesce((
         select sum(a.revenue_delta)
         from public.adjustments a
         where a.sale_id = p.sale_id
           and a.kind = 'write_off'
           and a.reason like 'cancelled installment ' || p.id::text || '%'
       ), 0) as written_off
from public.sale_payments p
left join public.payment_receipts r on r.sale_payment_id = p.id
where p.status = 'void'
group by p.id, p.sale_id, p.amount
having coalesce((
         select sum(a.revenue_delta)
         from public.adjustments a
         where a.sale_id = p.sale_id
           and a.kind = 'write_off'
           and a.reason like 'cancelled installment ' || p.id::text || '%'
       ), 0) <> -(p.amount - coalesce(sum(distinct r.amount), 0));
