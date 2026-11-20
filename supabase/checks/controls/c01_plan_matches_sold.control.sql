-- Control for C01: a sale with a positive line and no plan must be reported. Rolls back.
begin;

insert into public.sales (occurred_on, customer_id, is_first_visit)
values (
  date '2026-11-20',
  (select id from public.customers order by id limit 1),
  false
);

insert into public.sale_items (sale_id, description, quantity, unit_price)
select id, 'control: no plan', 1, 10
from public.sales
where occurred_on = date '2026-11-20'
order by created_at desc
limit 1;

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
    );

rollback;
