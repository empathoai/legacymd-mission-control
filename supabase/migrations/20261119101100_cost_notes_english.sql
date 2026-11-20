-- 101100_cost_notes_english.sql
-- Two cost functions still wrote a Spanish note. Recreated in English; behaviour unchanged.

CREATE OR REPLACE FUNCTION public.calibrate_month_cost(p_kind text, p_item_id uuid, p_month date, p_cost numeric, p_by text, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_item_cost(p_kind text, p_item_id uuid, p_cost numeric, p_from timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$;

update public.item_cost_history set note = 'entered by the owner' where note = 'cargado por la dueña';
update public.item_cost_history set note = 'calibrated by the owner' where note = 'calibrado por la dueña';
