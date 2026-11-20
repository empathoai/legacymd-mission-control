-- 095100_cost_timestamps.sql
-- A price change needs a timestamp, not just a day. Selling the last unit at 1,00 in the
-- morning and changing the price to 2,00 in the afternoon must leave the morning sale at
-- 1,00. A date cannot express that: both sales share the day.
--
--   * item_cost_history keeps timestamps: [effective_from, valid_to), valid_to = infinity
--     for the open interval.
--   * sales gains priced_at: the moment the price was fixed for that sale. New sales get
--     now(); the imported ones point to their visit day at noon, because they were all
--     inserted during the import in one afternoon.
--   * cost_at(kind, item, timestamptz) resolves the interval; sale_line_cost uses
--     priced_at.
--
-- The margin views keep reading sale_line_cost.unit_cost, so they do not change.

-- 1. When each sale was priced -------------------------------------------------

alter table public.sales add column if not exists priced_at timestamptz;

update public.sales
set priced_at = (occurred_on::timestamp + interval '12 hours')::timestamptz
where priced_at is null;

alter table public.sales alter column priced_at set default now();
alter table public.sales alter column priced_at set not null;

comment on column public.sales.priced_at is
  'Moment the cost was fixed for this sale. New sales use now(); imported sales point to their visit day at noon.';

create index if not exists sales_priced_at_idx on public.sales (priced_at);

-- 2. Intervals with timestamps -------------------------------------------------

alter table public.item_cost_history
  alter column effective_from type timestamptz using effective_from::timestamptz;

alter table public.item_cost_history
  alter column valid_to type timestamptz using case
    when valid_to = date '9999-12-31' then 'infinity'::timestamptz
    else (valid_to + 1)::timestamptz
  end;

comment on column public.item_cost_history.effective_from is
  'First moment the cost applies.';
comment on column public.item_cost_history.valid_to is
  'First moment it no longer applies. infinity for the open interval.';

create or replace function public.cost_intervals_do_not_overlap() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1
    from public.item_cost_history h
    where h.item_kind = new.item_kind
      and h.item_id = new.item_id
      and h.id <> new.id
      and tsrange(h.effective_from, h.valid_to, '[)')
          && tsrange(new.effective_from, new.valid_to, '[)')
  ) then
    raise exception 'cost intervals overlap for % %', new.item_kind, new.item_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- 3. Resolve a cost at a moment ------------------------------------------------

create or replace function public.cost_at(p_kind text, p_item_id uuid, p_at timestamptz)
returns numeric
language sql stable
as $$
  select h.cost
  from public.item_cost_history h
  where h.item_kind = p_kind
    and h.item_id = p_item_id
    and p_at >= h.effective_from
    and p_at < h.valid_to
  limit 1
$$;

comment on function public.cost_at(text, uuid, timestamptz) is
  'The cost in force for an item at a moment. Null when the moment is outside every interval.';

create or replace function public.cost_on(p_kind text, p_item_id uuid, p_on date)
returns numeric
language sql stable
as $$
  select public.cost_at(p_kind, p_item_id, p_on::timestamptz)
$$;

create or replace view public.sale_line_cost with (security_invoker = true) as
select
  i.id                                                        as sale_item_id,
  s.occurred_on,
  case
    when i.treatment_id is not null then 'treatment'
    when i.product_id is not null then 'product'
    when i.service_id is not null then 'service'
  end                                                         as item_kind,
  coalesce(i.treatment_id, i.product_id, i.service_id)        as item_id,
  public.cost_at(
    case
      when i.treatment_id is not null then 'treatment'
      when i.product_id is not null then 'product'
      when i.service_id is not null then 'service'
    end,
    coalesce(i.treatment_id, i.product_id, i.service_id),
    s.priced_at
  )                                                          as unit_cost
from public.sale_items i
join public.sales s on s.id = i.sale_id
where s.voided_at is null;

comment on view public.sale_line_cost is
  'The cost of each sale line, resolved from the price list at sales.priced_at. No stored copy.';

-- 4. The two operations, now on timestamps -------------------------------------

drop function if exists public.set_item_cost(text, uuid, numeric, date);

create or replace function public.set_item_cost(
  p_kind    text,
  p_item_id uuid,
  p_cost    numeric,
  p_from    timestamptz default now()
) returns void
language plpgsql
as $$
declare
  v_from  timestamptz := coalesce(p_from, now());
  v_next  timestamptz;
  v_known boolean;
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.treatments where id = p_item_id and p_kind = 'treatment'
    union all
    select 1 from public.products where id = p_item_id and p_kind = 'product'
    union all
    select 1 from public.services where id = p_item_id and p_kind = 'service'
  ) then
    raise exception 'item % of kind % does not exist', p_item_id, p_kind using errcode = '23503';
  end if;

  select min(effective_from) into v_next
  from public.item_cost_history
  where item_kind = p_kind and item_id = p_item_id and effective_from > v_from;

  update public.item_cost_history
  set cost = p_cost, note = 'entered by the owner'
  where item_kind = p_kind and item_id = p_item_id and effective_from = v_from;
  v_known := found;

  if not v_known then
    update public.item_cost_history
    set valid_to = v_from
    where item_kind = p_kind and item_id = p_item_id
      and effective_from < v_from and valid_to > v_from;

    insert into public.item_cost_history
      (item_kind, item_id, cost, effective_from, valid_to, note)
    values
      (p_kind, p_item_id, p_cost, v_from,
       coalesce(v_next, 'infinity'::timestamptz), 'entered by the owner');
  end if;
end;
$$;

comment on function public.set_item_cost(text, uuid, numeric, timestamptz) is
  'Defines the cost of an item from a moment to infinity. Closes the previous interval at that moment. Never touches a sale.';

drop function if exists public.calibrate_month_cost(text, uuid, date, numeric, text, text);

create or replace function public.calibrate_month_cost(
  p_kind    text,
  p_item_id uuid,
  p_month   date,
  p_cost    numeric,
  p_by      text,
  p_note    text default null
) returns integer
language plpgsql
as $$
declare
  m_start       timestamptz := date_trunc('month', p_month)::timestamptz;
  m_end         timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamptz;
  previous_cost numeric(10,2);
  affected      integer;
  r             record;
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive' using errcode = '22023';
  end if;

  previous_cost := public.cost_at(p_kind, p_item_id, m_start);

  for r in
    select * from public.item_cost_history
    where item_kind = p_kind and item_id = p_item_id
      and tsrange(effective_from, valid_to, '[)') && tsrange(m_start, m_end, '[)')
  loop
    if r.effective_from < m_start then
      update public.item_cost_history set valid_to = m_start where id = r.id;
      if r.valid_to > m_end then
        insert into public.item_cost_history
          (item_kind, item_id, cost, effective_from, valid_to, note)
        values
          (p_kind, p_item_id, r.cost, m_end, r.valid_to, r.note);
      end if;
    elsif r.valid_to > m_end then
      update public.item_cost_history set effective_from = m_end where id = r.id;
    else
      delete from public.item_cost_history where id = r.id;
    end if;
  end loop;

  insert into public.item_cost_history
    (item_kind, item_id, cost, effective_from, valid_to, note)
  values
    (p_kind, p_item_id, p_cost, m_start, m_end, coalesce(p_note, 'calibrated by the owner'));

  select count(*) into affected
  from public.sale_items i
  join public.sales s on s.id = i.sale_id
  where s.voided_at is null
    and date_trunc('month', s.occurred_on) = date_trunc('month', p_month)
    and case p_kind
          when 'treatment' then i.treatment_id = p_item_id
          when 'product'   then i.product_id = p_item_id
          else i.service_id = p_item_id
        end;

  insert into public.cost_calibrations
    (item_kind, item_id, month, old_cost, new_cost, lines_updated, calibrated_by, note)
  values
    (p_kind, p_item_id, date_trunc('month', p_month)::date, previous_cost, p_cost, affected, p_by, p_note);

  return affected;
end;
$$;

comment on function public.calibrate_month_cost(text, uuid, date, numeric, text, text) is
  'Sets the cost of one item for one whole month by editing the price list. Never touches a sale.';

-- 5. The reads that want "now" ------------------------------------------------

create or replace view public.catalog_items with (security_invoker = true) as
select
  'treatment'::text                                    as item_kind,
  t.id                                                  as item_id,
  t.code,
  t.name,
  t.price,
  public.cost_at('treatment', t.id, now())              as current_cost,
  t.active,
  t.unit_type
from public.treatments t
union all
select
  'product'::text,
  p.id,
  p.code,
  p.name,
  p.price,
  public.cost_at('product', p.id, now()),
  p.active,
  null::text
from public.products p
union all
select
  'service'::text,
  s.id,
  s.code,
  s.name,
  s.price,
  public.cost_at('service', s.id, now()),
  s.active,
  null::text
from public.services s;

create or replace view public.product_performance with (security_invoker = true) as
select
  p.id, p.name, p.price,
  public.cost_at('product', p.id, now())::numeric(10,2) as cost,
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
  public.cost_at('treatment', t.id, now())::numeric(10,2) as cost,
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
  public.cost_at('service', sv.id, now())::numeric(10,2) as cost,
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
