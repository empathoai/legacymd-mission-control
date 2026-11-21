-- Control for C21: simulate the old `void_payment` — an installment cancelled with a direct
-- UPDATE and no write-off — and prove the check sees it. Everything rolls back.
begin;

do $$
declare
  v_sale     uuid;
  v_pay      uuid;
  v_customer uuid;
  v_method   uuid;
  v_source   uuid;
begin
  select id into v_customer from public.customers
   where id in (select customer_id from public.sales) limit 1;
  select id into v_method from public.payment_methods limit 1;
  select id into v_source from public.sources limit 1;

  v_sale := public.create_sale(
    v_customer, date '2026-11-10', now(), v_source, null, null, 'control',
    jsonb_build_array(jsonb_build_object(
      'kind', 'custom', 'item_id', null, 'category_id', null,
      'description', 'control line', 'quantity', 2, 'unit_price', 50)),
    jsonb_build_array(
      jsonb_build_object('method_id', v_method, 'due_on', '2026-11-10', 'amount', 50, 'collected', 50),
      jsonb_build_object('method_id', v_method, 'due_on', '2026-12-10', 'amount', 50, 'collected', 0)));

  select id into v_pay from public.sale_payments
   where sale_id = v_sale and due_on = date '2026-12-10';

  -- The old behaviour: cancel without writing anything off.
  update public.sale_payments
  set status = 'void', voided_at = now(), void_reason = 'control', voided_by = 'control'
  where id = v_pay;
end $$;

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

rollback;
