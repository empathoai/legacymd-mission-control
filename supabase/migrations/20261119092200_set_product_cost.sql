-- 20261119092200_set_product_cost.sql
-- The owner types the real cost of a product. That number has to reach the
-- current month's lines (so today's margin is real) without touching closed
-- months (so history stays frozen).
-- One call does all three: catalog, cost history, and the open month's lines.

create or replace function public.set_product_cost(
  p_product_id uuid,
  p_cost       numeric,
  p_from       date default current_date
) returns integer
language plpgsql
as $$
declare
  updated_lines integer;
begin
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive';
  end if;

  update public.products
  set cost = p_cost, cost_is_estimated = false
  where id = p_product_id;

  insert into public.item_cost_history (item_kind, item_id, cost, effective_from, note)
  values ('product', p_product_id, p_cost, date_trunc('month', p_from)::date, 'entered by the owner')
  on conflict (item_kind, item_id, effective_from)
  do update set cost = excluded.cost, note = excluded.note;

  update public.sale_items i
  set unit_cost = p_cost,
      cost_source = 'edited'
  from public.sales s
  where i.sale_id = s.id
    and i.product_id = p_product_id
    and date_trunc('month', s.occurred_on) = date_trunc('month', p_from)
    and not i.cost_confirmed;

  get diagnostics updated_lines = row_count;
  return updated_lines;
end;
$$;

comment on function public.set_product_cost(uuid, numeric, date) is
  'Sets a product cost and recalculates that month''s unconfirmed lines only. Returns how many lines changed.';
