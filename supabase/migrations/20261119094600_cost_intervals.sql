-- 094600_cost_intervals.sql
-- The ERP model: a cost is a price list with validity, not a value frozen on a sale.
--   [2026-05-01, 2026-11-18]  cost 1
--   [2026-11-19, 9999-12-31]  cost 2
-- A sale is priced with the interval that covers its date. A change today closes the old
-- interval the day before and opens the new one to the end of time. Nothing rewrites a
-- sale: the transaction stores what was sold and what was charged, and the margin is
-- derived from the list.
--
-- Consequences:
--   * correcting a past interval changes the historical margin without touching a sale;
--   * a normal change today never touches the past, because the old interval still covers it;
--   * sale_items.unit_cost, line_cost, line_margin, cost_source and cost_confirmed become
--     meaningless and are removed. Deriving beats caching that can drift.

-- 1. Intervals ----------------------------------------------------------------

alter table public.item_cost_history add column if not exists valid_to date;

with ordered as (
  select id, lead(effective_from) over (
    partition by item_kind, item_id order by effective_from
  ) as next_from
  from public.item_cost_history
)
update public.item_cost_history h
set valid_to = coalesce(o.next_from - 1, date '9999-12-31')
from ordered o
where o.id = h.id;

alter table public.item_cost_history alter column valid_to set not null;

alter table public.item_cost_history drop constraint if exists cost_interval_valid;
alter table public.item_cost_history
  add constraint cost_interval_valid check (valid_to >= effective_from);

comment on column public.item_cost_history.valid_to is
  'Last day the cost applies. The open interval ends on 9999-12-31.';

create or replace function public.cost_intervals_do_not_overlap() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1
    from public.item_cost_history h
    where h.item_kind = new.item_kind
      and h.item_id = new.item_id
      and h.id <> new.id
      and daterange(h.effective_from, h.valid_to, '[]')
          && daterange(new.effective_from, new.valid_to, '[]')
  ) then
    raise exception 'cost intervals overlap for % %', new.item_kind, new.item_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists item_cost_history_no_overlap on public.item_cost_history;
create trigger item_cost_history_no_overlap
  before insert or update on public.item_cost_history
  for each row execute function public.cost_intervals_do_not_overlap();

create or replace function public.cost_on(p_kind text, p_item_id uuid, p_on date)
returns numeric
language sql stable
as $$
  select h.cost
  from public.item_cost_history h
  where h.item_kind = p_kind
    and h.item_id = p_item_id
    and p_on between h.effective_from and h.valid_to
  limit 1
$$;

comment on function public.cost_on(text, uuid, date) is
  'The cost in force for an item on a date. Null when the date is outside every interval.';

-- 2. Remove the frozen cost from the sale line --------------------------------

drop view if exists public.monthly_money;
drop view if exists public.item_monthly_profitability;
drop view if exists public.item_profitability;
drop view if exists public.monthly_pl;
drop view if exists public.profitability_by_kind;
drop view if exists public.profitability_by_category;
drop view if exists public.product_performance;
drop view if exists public.treatment_performance;
drop view if exists public.services_performance;

drop function if exists public.set_product_cost(uuid, numeric, date);
drop function if exists public.set_item_cost(text, uuid, numeric, date, boolean);
drop function if exists public.calibrate_month_cost(text, uuid, date, numeric, text, text);

alter table public.sale_items
  drop column if exists line_margin,
  drop column if exists line_cost,
  drop column if exists unit_cost,
  drop column if exists cost_confirmed,
  drop column if exists cost_source;

-- 3. One place that resolves the cost of a line -------------------------------

create view public.sale_line_cost with (security_invoker = true) as
select
  i.id                                                        as sale_item_id,
  s.occurred_on,
  case
    when i.treatment_id is not null then 'treatment'
    when i.product_id is not null then 'product'
    when i.service_id is not null then 'service'
  end                                                         as item_kind,
  coalesce(i.treatment_id, i.product_id, i.service_id)        as item_id,
  public.cost_on(
    case
      when i.treatment_id is not null then 'treatment'
      when i.product_id is not null then 'product'
      when i.service_id is not null then 'service'
    end,
    coalesce(i.treatment_id, i.product_id, i.service_id),
    s.occurred_on
  )                                                          as unit_cost
from public.sale_items i
join public.sales s on s.id = i.sale_id
where s.voided_at is null;

comment on view public.sale_line_cost is
  'The cost of each sale line, resolved from the price list by the sale date. No stored copy.';

-- 4. The money and margin views, now derived ----------------------------------

create view public.monthly_pl with (security_invoker = true) as
with revenue as (
  select date_trunc('month', c.occurred_on)::date as month,
         sum(i.line_total)::numeric(12,2) as revenue,
         sum(case when c.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
  from public.sale_items i
  join public.sale_line_cost c on c.sale_item_id = i.id
  group by 1
), cogs as (
  select date_trunc('month', c.occurred_on)::date as month,
         sum(i.quantity * coalesce(c.unit_cost, 0))::numeric(12,2) as cogs
  from public.sale_items i
  join public.sale_line_cost c on c.sale_item_id = i.id
  group by 1
), spend as (
  select p.period as month, sum(e.amount)::numeric(12,2) as expenses
  from public.expense_periods p
  join public.expense_entries e on e.period_id = p.id
  group by 1
)
select
  coalesce(r.month, c.month, s.month)                     as month,
  coalesce(r.revenue, 0)                                  as revenue,
  coalesce(c.cogs, 0)                                     as cogs,
  coalesce(r.revenue_with_cost, 0) - coalesce(c.cogs, 0)  as gross_margin,
  coalesce(s.expenses, 0)                                 as expenses,
  coalesce(r.revenue, 0) - coalesce(s.expenses, 0)       as cash_result,
  coalesce(r.revenue_with_cost, 0)                        as revenue_with_cost
from revenue r
full join cogs c on c.month = r.month
full join spend s on s.month = coalesce(r.month, c.month)
order by 1;

comment on view public.monthly_pl is
  'Revenue, cost from the price list and cash expenses. gross_margin uses revenue_with_cost, so a line with no cost interval never produces a margin.';

create view public.item_profitability with (security_invoker = true) as
select
  coalesce(t.id, p.id, sv.id)                                 as item_id,
  coalesce(t.name, p.name, sv.name, i.description)            as item_name,
  case
    when t.id is not null then 'treatment'
    when p.id is not null then 'product'
    when sv.id is not null then 'service'
    else 'unmapped'
  end                                                         as kind,
  count(*)                                                    as lines,
  sum(i.quantity)::numeric(12,2)                              as units,
  sum(i.line_total)::numeric(12,2)                            as revenue,
  bool_and(c.unit_cost is not null)                           as cost_known,
  sum(i.quantity * coalesce(c.unit_cost, 0))::numeric(12,2)   as cost,
  (sum(case when c.unit_cost is not null then i.line_total else 0 end)
    - sum(i.quantity * coalesce(c.unit_cost, 0)))::numeric(12,2) as margin,
  sum(case when c.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sale_line_cost c on c.sale_item_id = i.id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id
group by 1, 2, 3;

comment on view public.item_profitability is
  'Per catalog item over the whole history. Cost comes from the price list by sale date; margin uses revenue_with_cost.';

create view public.item_monthly_profitability with (security_invoker = true) as
select
  date_trunc('month', c.occurred_on)::date                    as month,
  coalesce(t.id, p.id, sv.id)                                 as item_id,
  coalesce(t.name, p.name, sv.name, i.description)            as item_name,
  case
    when t.id is not null then 'treatment'
    when p.id is not null then 'product'
    when sv.id is not null then 'service'
    else 'unmapped'
  end                                                         as kind,
  count(*)                                                    as lines,
  sum(i.quantity)::numeric(12,2)                              as units,
  sum(i.line_total)::numeric(12,2)                            as revenue,
  sum(i.quantity * coalesce(c.unit_cost, 0))::numeric(12,2)   as cost,
  sum(case when c.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost,
  (sum(case when c.unit_cost is not null then i.line_total else 0 end)
    - sum(i.quantity * coalesce(c.unit_cost, 0)))::numeric(12,2) as margin,
  round(100.0 * (sum(case when c.unit_cost is not null then i.line_total else 0 end)
    - sum(i.quantity * coalesce(c.unit_cost, 0)))
    / nullif(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0), 1) as margin_pct,
  bool_and(c.unit_cost is not null)                           as cost_known
from public.sale_items i
join public.sale_line_cost c on c.sale_item_id = i.id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id
group by 1, 2, 3, 4;

comment on view public.item_monthly_profitability is
  'The report: revenue, cost from the price list and margin per treatment and per product, accumulated by month.';

create view public.profitability_by_kind with (security_invoker = true) as
select
  date_trunc('month', c.occurred_on)::date                    as month,
  case
    when i.treatment_id is not null then 'treatment'
    when i.product_id is not null then 'product'
    when i.service_id is not null then 'service'
    else 'unmapped'
  end                                                         as kind,
  count(*)                                                    as lines,
  sum(i.quantity)::numeric(12,2)                              as units,
  sum(i.line_total)::numeric(12,2)                            as revenue,
  sum(i.quantity * coalesce(c.unit_cost, 0))::numeric(12,2)   as cost,
  (sum(case when c.unit_cost is not null then i.line_total else 0 end)
    - sum(i.quantity * coalesce(c.unit_cost, 0)))::numeric(12,2) as margin,
  sum(case when c.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sale_line_cost c on c.sale_item_id = i.id
group by 1, 2;

create view public.profitability_by_category with (security_invoker = true) as
select
  date_trunc('month', c.occurred_on)::date                    as month,
  coalesce(cat.slug, 'uncategorised')                         as category,
  coalesce(cat.label, 'Uncategorised')                        as category_label,
  count(*)                                                    as lines,
  sum(i.line_total)::numeric(12,2)                            as revenue,
  sum(i.quantity * coalesce(c.unit_cost, 0))::numeric(12,2)   as cost,
  (sum(case when c.unit_cost is not null then i.line_total else 0 end)
    - sum(i.quantity * coalesce(c.unit_cost, 0)))::numeric(12,2) as margin,
  round(100.0 * (sum(case when c.unit_cost is not null then i.line_total else 0 end)
    - sum(i.quantity * coalesce(c.unit_cost, 0)))
    / nullif(sum(case when c.unit_cost is not null then i.line_total else 0 end), 0), 1) as margin_pct,
  sum(case when c.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sale_line_cost c on c.sale_item_id = i.id
left join public.categories cat on cat.id = i.category_id
group by 1, 2, 3;

create view public.product_performance with (security_invoker = true) as
select
  p.id, p.name, p.price, p.cost,
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
group by p.id, p.name, p.price, p.cost;

create view public.treatment_performance with (security_invoker = true) as
select
  t.id, t.name, t.price, t.cost,
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
group by t.id, t.name, t.price, t.cost;

create view public.services_performance with (security_invoker = true) as
select
  sv.id, sv.name, sv.price, sv.cost,
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
group by sv.id, sv.name, sv.price, sv.cost;

create view public.monthly_money with (security_invoker = true) as
with rev as (
  select month, revenue from public.monthly_pl
), ret as (
  select date_trunc('month', refunded_on)::date as month,
         sum(amount)::numeric(12,2) as returned
  from public.sale_refunds
  group by 1
), adj as (
  select date_trunc('month', occurred_on)::date as month,
         sum(revenue_delta)::numeric(12,2) as revenue_delta,
         sum(cash_delta)::numeric(12,2) as cash_delta
  from public.adjustments
  group by 1
), col as (
  select month, collected from public.cash_collected
)
select
  coalesce(rev.month, ret.month, adj.month, col.month)      as month,
  coalesce(rev.revenue, 0)::numeric(12,2)                   as gross_revenue,
  coalesce(ret.returned, 0)::numeric(12,2)                  as returned,
  coalesce(adj.revenue_delta, 0)::numeric(12,2)             as adjustment_revenue,
  coalesce(adj.cash_delta, 0)::numeric(12,2)                as adjustment_cash,
  (coalesce(rev.revenue, 0)
    - coalesce(ret.returned, 0)
    + coalesce(adj.revenue_delta, 0))::numeric(12,2)        as net_revenue,
  coalesce(col.collected, 0)::numeric(12,2)                 as collected
from rev
full join ret on ret.month = rev.month
full join adj on adj.month = coalesce(rev.month, ret.month)
full join col on col.month = coalesce(rev.month, ret.month, adj.month)
order by 1;

-- 5. The two operations, now on the price list --------------------------------

create or replace function public.set_item_cost(
  p_kind    text,
  p_item_id uuid,
  p_cost    numeric,
  p_from    date default current_date
) returns integer
language plpgsql
as $$
declare
  v_from  date := coalesce(p_from, current_date);
  v_next  date;
  v_known boolean;
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive' using errcode = '22023';
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
    set valid_to = v_from - 1
    where item_kind = p_kind and item_id = p_item_id
      and effective_from < v_from and valid_to >= v_from;

    insert into public.item_cost_history
      (item_kind, item_id, cost, effective_from, valid_to, note)
    values
      (p_kind, p_item_id, p_cost, v_from,
       coalesce(v_next - 1, date '9999-12-31'), 'entered by the owner');
  end if;

  if v_from <= current_date then
    if p_kind = 'product' then
      update public.products set cost = p_cost, cost_is_estimated = false where id = p_item_id;
    elsif p_kind = 'treatment' then
      update public.treatments set cost = p_cost, cost_is_estimated = false where id = p_item_id;
    else
      update public.services set cost = p_cost, cost_is_estimated = false where id = p_item_id;
    end if;
    if not found then
      raise exception 'item % of kind % does not exist', p_item_id, p_kind using errcode = '23503';
    end if;
  end if;

  return 1;
end;
$$;

comment on function public.set_item_cost(text, uuid, numeric, date) is
  'Defines the cost of an item from a date to the end of time. Closes the previous interval the day before. Never touches a sale.';

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
  m_start       date := date_trunc('month', p_month)::date;
  m_end         date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
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

  previous_cost := public.cost_on(p_kind, p_item_id, m_start);

  for r in
    select * from public.item_cost_history
    where item_kind = p_kind and item_id = p_item_id
      and daterange(effective_from, valid_to, '[]') && daterange(m_start, m_end, '[]')
  loop
    if r.effective_from < m_start then
      update public.item_cost_history set valid_to = m_start - 1 where id = r.id;
      if r.valid_to > m_end then
        insert into public.item_cost_history
          (item_kind, item_id, cost, effective_from, valid_to, note)
        values
          (p_kind, p_item_id, r.cost, m_end + 1, r.valid_to, r.note);
      end if;
    elsif r.valid_to > m_end then
      update public.item_cost_history set effective_from = m_end + 1 where id = r.id;
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
    and date_trunc('month', s.occurred_on) = m_start
    and case p_kind
          when 'treatment' then i.treatment_id = p_item_id
          when 'product'   then i.product_id = p_item_id
          else i.service_id = p_item_id
        end;

  insert into public.cost_calibrations
    (item_kind, item_id, month, old_cost, new_cost, lines_updated, calibrated_by, note)
  values
    (p_kind, p_item_id, m_start, previous_cost, p_cost, affected, p_by, p_note);

  return affected;
end;
$$;

comment on function public.calibrate_month_cost(text, uuid, date, numeric, text, text) is
  'Sets the cost of one item for one whole month by editing the price list. Returns how many sale lines the month has, for the confirmation message. Never touches a sale.';
