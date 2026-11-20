-- 20261120130000_expense_writes.sql
-- The expense month gets a real write layer. Until now the 99 entries were imported
-- directly and the only rule was the guard trigger that refuses a closed month.
--
-- The shape stays the owner's sheet: one line per expense item (and supplier) in a
-- month, with an amount and a note. That is the unique key the import created, kept
-- here as a partial unique index so a voided line frees its slot.
--
-- Nothing is deleted. A wrong line is voided with a reason and stops counting; the
-- totals and the three views learn to skip it.

alter table public.expense_entries
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists voided_at  timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by  text;

alter table public.expense_entries drop constraint if exists expense_void_has_control;
alter table public.expense_entries
  add constraint expense_void_has_control check (
    (voided_at is not null) = (void_reason is not null and voided_by is not null)
  );

comment on column public.expense_entries.voided_at is
  'A voided line stays in the month for the record and stops counting in every total.';

alter table public.expense_entries
  drop constraint if exists expense_entries_period_id_item_id_supplier_id_key;

create unique index if not exists expense_entries_month_line_uidx
  on public.expense_entries (period_id, item_id, supplier_id)
  nulls not distinct
  where voided_at is null;

-- Every close and every reopen: who, when and why. Append-only, like a receipt.
create table if not exists public.expense_period_changes (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references public.expense_periods(id) on delete restrict,
  old_status  text not null check (old_status in ('open', 'closed')),
  new_status  text not null check (new_status in ('open', 'closed')),
  changed_at  timestamptz not null default now(),
  changed_by  text not null,
  reason      text not null check (length(btrim(reason)) >= 4),
  constraint change_moves_the_status check (old_status <> new_status)
);

create index if not exists expense_period_changes_idx
  on public.expense_period_changes (period_id, changed_at);

create or replace function public.expense_period_changes_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'expense_period_changes is append-only' using errcode = '23514';
end;
$$;

drop trigger if exists expense_period_changes_append_only on public.expense_period_changes;
create trigger expense_period_changes_append_only
  before update or delete on public.expense_period_changes
  for each row execute function public.expense_period_changes_immutable();

revoke update, delete on public.expense_period_changes from anon, authenticated;

-- Opens the month the first time it is touched. The period is always the first day.
create or replace function public.start_expense_month(
  p_period date,
  p_by     text
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'started_by is required' using errcode = '22023';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'a period must be the first day of its month' using errcode = '22023';
  end if;

  select id into v_id from public.expense_periods where period = p_period;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.expense_periods (period, status)
  values (p_period, 'open')
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.start_expense_month(date, text) is
  'Creates the month if it does not exist and returns it. Never touches a closed one.';

-- Add or correct one line of the month. The guard trigger refuses a closed period.
create or replace function public.set_expense_entry(
  p_period_id   uuid,
  p_item_id     uuid,
  p_supplier_id uuid,
  p_amount      numeric,
  p_note        text,
  p_by          text
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'recorded_by is required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'an amount of zero or more is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.expense_items where id = p_item_id) then
    raise exception 'expense item % does not exist', p_item_id using errcode = '23503';
  end if;
  if p_supplier_id is not null
     and not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'supplier % does not exist', p_supplier_id using errcode = '23503';
  end if;

  select id into v_id
  from public.expense_entries
  where period_id = p_period_id
    and item_id = p_item_id
    and supplier_id is not distinct from p_supplier_id
    and voided_at is null;

  if v_id is not null then
    update public.expense_entries
    set amount = p_amount,
        note = nullif(btrim(coalesce(p_note, '')), ''),
        updated_by = p_by
    where id = v_id;
    return v_id;
  end if;

  insert into public.expense_entries
    (period_id, item_id, supplier_id, amount, note, created_by)
  values
    (p_period_id, p_item_id, p_supplier_id, p_amount,
     nullif(btrim(coalesce(p_note, '')), ''), p_by)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.set_expense_entry(uuid, uuid, uuid, numeric, text, text) is
  'Adds or corrects the one line a month has for an item and supplier. The month stays a sheet.';

create or replace function public.void_expense_entry(
  p_id     uuid,
  p_by     text,
  p_reason text
) returns void
language plpgsql
as $$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'voided_by is required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 4 then
    raise exception 'a reason of at least 4 characters is required' using errcode = '22023';
  end if;

  update public.expense_entries
  set voided_at = now(),
      void_reason = btrim(p_reason),
      voided_by = p_by
  where id = p_id and voided_at is null;

  if not found then
    raise exception 'entry % does not exist or is already voided', p_id using errcode = '23503';
  end if;
end;
$$;

comment on function public.void_expense_entry(uuid, text, text) is
  'Retires a line with a reason. The row stays; the totals stop counting it.';

create or replace function public.close_expense_period(
  p_id uuid,
  p_by text
) returns void
language plpgsql
as $$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'closed_by is required' using errcode = '22023';
  end if;

  update public.expense_periods p
  set status = 'closed',
      closed_at = now(),
      total = (select coalesce(sum(e.amount), 0)
               from public.expense_entries e
               where e.period_id = p.id and e.voided_at is null)
  where p.id = p_id and p.status = 'open';

  if not found then
    raise exception 'period % does not exist or is already closed', p_id using errcode = '23503';
  end if;

  insert into public.expense_period_changes
    (period_id, old_status, new_status, changed_by, reason)
  values
    (p_id, 'open', 'closed', p_by, 'closed from the expenses screen');
end;
$$;

comment on function public.close_expense_period(uuid, text) is
  'Freezes the month and stores its total. The guard then refuses every write until it is reopened.';

create or replace function public.reopen_expense_period(
  p_id     uuid,
  p_by     text,
  p_reason text
) returns void
language plpgsql
as $$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'changed_by is required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 4 then
    raise exception 'a reason of at least 4 characters is required' using errcode = '22023';
  end if;

  update public.expense_periods
  set status = 'open',
      closed_at = null,
      total = null
  where id = p_id and status = 'closed';

  if not found then
    raise exception 'period % does not exist or is not closed', p_id using errcode = '23503';
  end if;

  insert into public.expense_period_changes
    (period_id, old_status, new_status, changed_by, reason)
  values
    (p_id, 'closed', 'open', p_by, btrim(p_reason));
end;
$$;

comment on function public.reopen_expense_period(uuid, text, text) is
  'Unlocks a closed month with a reason. Close it again to store the corrected total.';

-- The three views stop counting voided lines.
create or replace view public.expense_by_category with (security_invoker = true) as
select p.period as month, c.slug as category, c.label, sum(e.amount)::numeric(12,2) as amount
from public.expense_entries e
join public.expense_periods p on p.id = e.period_id
join public.expense_items i on i.id = e.item_id
join public.expense_categories c on c.id = i.category_id
where e.voided_at is null
group by 1, 2, 3
order by 1, 2;

create or replace view public.monthly_pl with (security_invoker = true) as
with revenue as (
  select date_trunc('month', lc.occurred_on)::date as month,
         sum(i.line_total)::numeric(12,2) as revenue,
         sum(case when lc.unit_cost is not null then i.line_total else 0 end)::numeric(12,2)
           as revenue_with_cost
  from public.sale_items i
  join public.sale_line_cost lc on lc.sale_item_id = i.id
  group by 1
), cogs as (
  select date_trunc('month', lc.occurred_on)::date as month,
         sum(i.quantity * coalesce(lc.unit_cost, 0))::numeric(12,2) as cogs
  from public.sale_items i
  join public.sale_line_cost lc on lc.sale_item_id = i.id
  group by 1
), spend as (
  select p.period as month, sum(e.amount)::numeric(12,2) as expenses
  from public.expense_periods p
  join public.expense_entries e on e.period_id = p.id
  where e.voided_at is null
  group by p.period
)
select coalesce(r.month, c.month, s.month) as month,
       coalesce(r.revenue, 0) as revenue,
       coalesce(c.cogs, 0) as cogs,
       (coalesce(r.revenue_with_cost, 0) - coalesce(c.cogs, 0)) as gross_margin,
       coalesce(s.expenses, 0) as expenses,
       (coalesce(r.revenue, 0) - coalesce(s.expenses, 0)) as cash_result,
       coalesce(r.revenue_with_cost, 0) as revenue_with_cost
from revenue r
full join cogs c on c.month = r.month
full join spend s on s.month = coalesce(r.month, c.month)
order by coalesce(r.month, c.month, s.month);

create or replace view public.monthly_balance with (security_invoker = true) as
with revenue as (
  select date_trunc('month', occurred_on)::date as month, sum(total) as amount
  from public.sales_with_totals
  group by 1
), spend as (
  select p.period as month, sum(e.amount) as amount
  from public.expense_periods p
  join public.expense_entries e on e.period_id = p.id
  where e.voided_at is null
  group by 1
)
select coalesce(r.month, s.month) as month,
       coalesce(r.amount, 0)::numeric(12,2) as revenue,
       coalesce(s.amount, 0)::numeric(12,2) as expenses,
       (coalesce(r.amount, 0) - coalesce(s.amount, 0))::numeric(12,2) as balance
from revenue r
full join spend s on s.month = r.month
order by 1;
