-- 094800_catalog_active_and_codes.sql
-- The catalog is a living list: items are deactivated when a replacement arrives, never
-- deleted, so every past sale still resolves. Two behaviors:
--   * a new item without a code gets the next one for its kind;
--   * an inactive item cannot be sold.
-- The catalog's displayed cost comes from the price interval, not from a stored column
-- that a future-dated change would leave stale.

create or replace function public.assign_catalog_code() returns trigger
language plpgsql as $$
declare
  prefix text;
  next_n integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  prefix := case TG_TABLE_NAME
              when 'treatments' then 'TRT-'
              when 'products'   then 'PROD-'
              else 'SRV-'
            end;

  execute format(
    'select coalesce(max(substring(code from ''[0-9]+$'')::int), 0) + 1 from public.%I',
    TG_TABLE_NAME
  ) into next_n;

  new.code := prefix || lpad(next_n::text, 4, '0');
  return new;
end;
$$;

comment on function public.assign_catalog_code() is
  'Fills a missing catalog code with the next number for its kind. Runs before the not-null check.';

drop trigger if exists treatments_assign_code on public.treatments;
create trigger treatments_assign_code before insert on public.treatments
  for each row execute function public.assign_catalog_code();

drop trigger if exists products_assign_code on public.products;
create trigger products_assign_code before insert on public.products
  for each row execute function public.assign_catalog_code();

drop trigger if exists services_assign_code on public.services;
create trigger services_assign_code before insert on public.services
  for each row execute function public.assign_catalog_code();

create or replace function public.reject_inactive_catalog_item() returns trigger
language plpgsql as $$
begin
  if new.treatment_id is not null
     and not exists (select 1 from public.treatments where id = new.treatment_id and active) then
    raise exception 'treatment % is inactive and cannot be sold', new.treatment_id
      using errcode = '23514';
  end if;
  if new.product_id is not null
     and not exists (select 1 from public.products where id = new.product_id and active) then
    raise exception 'product % is inactive and cannot be sold', new.product_id
      using errcode = '23514';
  end if;
  if new.service_id is not null
     and not exists (select 1 from public.services where id = new.service_id and active) then
    raise exception 'service % is inactive and cannot be sold', new.service_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.reject_inactive_catalog_item() is
  'An inactive catalog item can be read by history but never sold again.';

drop trigger if exists sale_items_reject_inactive on public.sale_items;
create trigger sale_items_reject_inactive
  before insert or update of treatment_id, product_id, service_id on public.sale_items
  for each row execute function public.reject_inactive_catalog_item();

create or replace view public.product_performance with (security_invoker = true) as
select
  p.id, p.name, p.price,
  public.cost_on('product', p.id, current_date)::numeric(10,2) as cost,
  count(i.id)                                                 as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                 as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)               as revenue,
  coalesce(sum(i.quantity * coalesce(c.unit_cost, 0)), 0)::numeric(12,2) as total_cost,
  (coalesce(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0)
    - coalesce(sum(i.quantity * coalesce(c.unit_cost, 0)), 0))::numeric(12,2) as margin,
  coalesce(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0)::numeric(12,2) as revenue_with_cost
from public.products p
left join public.sale_items i on i.product_id = p.id
left join public.sale_line_cost c on c.sale_item_id = i.id
group by p.id, p.name, p.price;

create or replace view public.treatment_performance with (security_invoker = true) as
select
  t.id, t.name, t.price,
  public.cost_on('treatment', t.id, current_date)::numeric(10,2) as cost,
  count(i.id)                                                 as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                 as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)               as revenue,
  coalesce(sum(i.quantity * coalesce(c.unit_cost, 0)), 0)::numeric(12,2) as total_cost,
  (coalesce(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0)
    - coalesce(sum(i.quantity * coalesce(c.unit_cost, 0)), 0))::numeric(12,2) as margin,
  coalesce(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0)::numeric(12,2) as revenue_with_cost
from public.treatments t
left join public.sale_items i on i.treatment_id = t.id
left join public.sale_line_cost c on c.sale_item_id = i.id
group by t.id, t.name, t.price;

create or replace view public.services_performance with (security_invoker = true) as
select
  sv.id, sv.name, sv.price,
  public.cost_on('service', sv.id, current_date)::numeric(10,2) as cost,
  count(i.id)                                                 as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                 as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)               as revenue,
  coalesce(sum(i.quantity * coalesce(c.unit_cost, 0)), 0)::numeric(12,2) as total_cost,
  (coalesce(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0)
    - coalesce(sum(i.quantity * coalesce(c.unit_cost, 0)), 0))::numeric(12,2) as margin,
  coalesce(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0)::numeric(12,2) as revenue_with_cost
from public.services sv
left join public.sale_items i on i.service_id = sv.id
left join public.sale_line_cost c on c.sale_item_id = i.id
group by sv.id, sv.name, sv.price;
