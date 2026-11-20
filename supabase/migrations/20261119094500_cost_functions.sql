-- 094500_cost_functions.sql
-- Decision D7 in code. Two operations, two different jobs:
--   set_item_cost       the current reference: catalog + history + the open month's
--                       unconfirmed lines. The catalog changes because it is today's cost.
--   calibrate_month_cost  one past month: history + that month's lines, confirmed.
--                       The catalog does NOT change: a past cost is not today's default.
-- Every calibration leaves a row in cost_calibrations with the previous value, because a
-- second calibration is a correction, not a silent rewrite.

create table if not exists public.cost_calibrations (
  id             uuid primary key default gen_random_uuid(),
  item_kind      text not null check (item_kind in ('treatment', 'product', 'service')),
  item_id        uuid not null,
  month          date not null,
  old_cost       numeric(10,2),
  new_cost       numeric(10,2) not null check (new_cost >= 0),
  lines_updated  integer not null,
  calibrated_by  text not null,
  note           text,
  created_at     timestamptz not null default now()
);

comment on table public.cost_calibrations is
  'One row per month calibration, including the value it replaced. The record of a correction.';

create index if not exists cost_calibrations_item_idx
  on public.cost_calibrations (item_kind, item_id, month);

create or replace function public.set_item_cost(
  p_kind     text,
  p_item_id  uuid,
  p_cost     numeric,
  p_from     date default current_date,
  p_confirm  boolean default false
) returns integer
language plpgsql
as $$
declare
  updated_lines integer;
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive' using errcode = '22023';
  end if;

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

  insert into public.item_cost_history (item_kind, item_id, cost, effective_from, note)
  values (p_kind, p_item_id, p_cost, date_trunc('month', p_from)::date, 'entered by the owner')
  on conflict (item_kind, item_id, effective_from)
  do update set cost = excluded.cost, note = excluded.note;

  update public.sale_items i
  set unit_cost = p_cost,
      cost_source = 'edited',
      cost_confirmed = p_confirm
  from public.sales s
  where i.sale_id = s.id
    and s.voided_at is null
    and date_trunc('month', s.occurred_on) = date_trunc('month', p_from)
    and not i.cost_confirmed
    and case p_kind
          when 'treatment' then i.treatment_id = p_item_id
          when 'product'   then i.product_id = p_item_id
          else i.service_id = p_item_id
        end;

  get diagnostics updated_lines = row_count;
  return updated_lines;
end;
$$;

comment on function public.set_item_cost(text, uuid, numeric, date, boolean) is
  'Sets the current cost of an item: catalog, cost history and that month''s unconfirmed lines. Returns the lines changed. The catalog changes because this is today''s reference.';

create or replace function public.calibrate_month_cost(
  p_kind      text,
  p_item_id   uuid,
  p_month     date,
  p_cost      numeric,
  p_by        text,
  p_note      text default null
) returns integer
language plpgsql
as $$
declare
  target_month  date := date_trunc('month', p_month)::date;
  previous_cost numeric(10,2);
  updated_lines integer;
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive' using errcode = '22023';
  end if;
  if p_month is null then
    raise exception 'a month is required' using errcode = '22023';
  end if;

  select cost into previous_cost
  from public.item_cost_history
  where item_kind = p_kind and item_id = p_item_id and effective_from = target_month;

  insert into public.item_cost_history (item_kind, item_id, cost, effective_from, note)
  values (p_kind, p_item_id, p_cost, target_month, coalesce(p_note, 'calibrated by the owner'))
  on conflict (item_kind, item_id, effective_from)
  do update set cost = excluded.cost, note = excluded.note;

  update public.sale_items i
  set unit_cost = p_cost,
      cost_source = 'edited',
      cost_confirmed = true
  from public.sales s
  where i.sale_id = s.id
    and s.voided_at is null
    and date_trunc('month', s.occurred_on) = target_month
    and case p_kind
          when 'treatment' then i.treatment_id = p_item_id
          when 'product'   then i.product_id = p_item_id
          else i.service_id = p_item_id
        end;

  get diagnostics updated_lines = row_count;

  insert into public.cost_calibrations
    (item_kind, item_id, month, old_cost, new_cost, lines_updated, calibrated_by, note)
  values (p_kind, p_item_id, target_month, previous_cost, p_cost, updated_lines, p_by, p_note);

  return updated_lines;
end;
$$;

comment on function public.calibrate_month_cost(text, uuid, date, numeric, text, text) is
  'Calibrates one past month for one item: writes the cost history for that month and recalculates its lines as confirmed. Never touches the catalog. Returns the lines changed.';
