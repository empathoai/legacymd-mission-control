-- C01: for every sale, what it sold equals what its plan expects, minus what was forgiven.
-- A live sale with a positive total and no plan is also reported: it cannot be collected.
select
  s.id,
  s.occurred_on,
  coalesce(sum(i.line_total), 0)::numeric(12,2) as sold,
  coalesce((
    select sum(p.amount)
    from public.sale_payments p
    where p.sale_id = s.id and p.status <> 'void'
  ), 0)::numeric(12,2) as planned,
  coalesce((
    select sum(a.revenue_delta)
    from public.adjustments a
    where a.sale_id = s.id and a.kind = 'write_off'
  ), 0)::numeric(12,2) as written_off
from public.sales s
left join public.sale_items i on i.sale_id = s.id
where s.voided_at is null
group by s.id, s.occurred_on
having coalesce(sum(i.line_total), 0)::numeric(12,2) is distinct from (
         coalesce((
           select sum(p.amount)
           from public.sale_payments p
           where p.sale_id = s.id and p.status <> 'void'
         ), 0)::numeric(12,2)
         - coalesce((
           select sum(a.revenue_delta)
           from public.adjustments a
           where a.sale_id = s.id and a.kind = 'write_off'
         ), 0)::numeric(12,2)
       )
    or (
      coalesce(sum(i.line_total), 0) > 0
      and coalesce((
        select sum(p.amount)
        from public.sale_payments p
        where p.sale_id = s.id and p.status <> 'void'
      ), 0) = 0
      and coalesce((
        select sum(a.revenue_delta)
        from public.adjustments a
        where a.sale_id = s.id and a.kind = 'write_off'
      ), 0) = 0
    )
order by s.occurred_on, s.id;
