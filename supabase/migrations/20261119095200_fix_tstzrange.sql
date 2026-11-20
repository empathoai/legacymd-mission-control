-- 095200_fix_tstzrange.sql
-- Postgres has tsrange for timestamp and tstzrange for timestamptz. The overlap check
-- used tsrange against timestamptz columns, which raised 42883 when an interval was
-- edited. Both functions are replaced with tstzrange.

create or replace function public.cost_intervals_do_not_overlap() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1
    from public.item_cost_history h
    where h.item_kind = new.item_kind
      and h.item_id = new.item_id
      and h.id <> new.id
      and tstzrange(h.effective_from, h.valid_to, '[)')
          && tstzrange(new.effective_from, new.valid_to, '[)')
  ) then
    raise exception 'cost intervals overlap for % %', new.item_kind, new.item_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

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
      and tstzrange(effective_from, valid_to, '[)') && tstzrange(m_start, m_end, '[)')
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
