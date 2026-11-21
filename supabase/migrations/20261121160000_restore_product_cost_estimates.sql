-- 20261121160000_restore_product_cost_estimates.sql
-- Four products the owner's sheet does not list still read a $1.00 cost, which says a
-- $50 supplement costs a dollar: a margin of 98% that nobody believes. The base held a
-- real estimate for them until 2026-11-01, when the cutover replaced it with the
-- placeholder. This puts the estimate back where the placeholder stood — it is still an
-- estimate, and the owner's purchase cost is what makes it true.
--
-- No new number is invented here: 57.40, 57.40, 35.00 and 35.00 are the values the base
-- already carried for May–October, kept open from 2026-11-01.

do $$
declare
  v_wrong int;
  v_placeholder int;
begin
  create temporary table keep_costs (code text primary key, cost numeric not null) on commit drop;
  insert into keep_costs (code, cost) values
    ('PROD-0002', 57.40),  -- Arum Life
    ('PROD-0004', 57.40),  -- Arum Vital
    ('PROD-0010', 35.00),  -- FemGuard
    ('PROD-0025', 35.00);  -- Perform Supplement

  -- Drop the placeholder interval, then extend the estimate that precedes it.
  delete from public.item_cost_history h
  using public.products p, keep_costs k
  where h.item_kind = 'product'
    and h.item_id = p.id
    and p.code = k.code
    and h.effective_from >= timestamptz '2026-11-01 00:00:00+00';

  update public.item_cost_history h
  set valid_to = 'infinity'
  from public.products p, keep_costs k
  where h.item_kind = 'product'
    and h.item_id = p.id
    and p.code = k.code
    and h.valid_to = timestamptz '2026-11-01 00:00:00+00';

  select count(*) into v_wrong
  from keep_costs k
  join public.products p on p.code = k.code
  where public.cost_on('product', p.id, date '2026-11-21') is distinct from k.cost;
  if v_wrong > 0 then
    raise exception 'C: % products do not read the kept estimate', v_wrong;
  end if;

  select count(*) into v_placeholder
  from public.products p
  where p.active
    and public.cost_on('product', p.id, date '2026-11-21') = 1.00;
  if v_placeholder > 0 then
    raise exception 'C: % active products still read the 1.00 placeholder', v_placeholder;
  end if;

  raise notice 'four product cost estimates reopened from 2026-11-01';
end $$;
