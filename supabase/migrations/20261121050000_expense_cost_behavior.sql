-- 20261121050000_expense_cost_behavior.sql
-- Expenses learn what kind of cost each concept is, and the owner stops hiding in
-- payroll.
--
-- Until now payroll was one line of 14880.00 that mixed the assistant's wage with the
-- owner's monthly draw. Operating profit cannot be read from that: a draw is a
-- distribution of profit, not a clinic cost. The concept becomes 'Staff payroll'
-- (2880.00) and a new 'Owner draw' (12000.00) carries the rest, so every concept can
-- be classified by cost_behavior and inspected by reports without matching on names.
--
-- The historical months keep the exact amount they had: each payroll line of 14880.00
-- becomes 2880.00 plus one 12000.00 owner draw, a delta of 0.00. The closed months
-- (May-Oct 2026) stay closed with the same total, which C18 verifies; the guard
-- trigger is disabled for this transaction only because the split touches closed
-- periods by design, and is enabled again before the file ends.
--
-- Every concept also gets a short guidance line in English: what belongs in it and
-- what does not. The entry dialog shows it the moment the concept is picked.

-- 1. What kind of cost a concept is, and how to explain it to the person typing.

alter table public.expense_items
  add column if not exists cost_behavior text not null default 'fixed';
alter table public.expense_items
  add column if not exists guidance text;

alter table public.expense_items
  drop constraint if exists expense_items_cost_behavior_check;
alter table public.expense_items
  add constraint expense_items_cost_behavior_check
  check (cost_behavior in ('fixed', 'variable', 'acquisition', 'owner_draw', 'capex'));

comment on column public.expense_items.cost_behavior is
  'How the cost behaves: fixed, variable, acquisition, owner_draw or capex. Reports classify by this column, never by name.';
comment on column public.expense_items.guidance is
  'Short English note shown in the entry dialog: what to record in this concept and what not to.';

-- 2. Every existing concept is classified, with the guidance the dialog will show.

update public.expense_items i
set name          = v.name,
    cost_behavior = v.cost_behavior,
    recurring     = v.recurring,
    guidance      = v.guidance
from (values
  ('advertising', 'Advertising', 'acquisition', true,
   'Paid media placed directly: Meta, Google, TikTok. Do not put agency retainers or consulting fees here.'),
  ('bank_fees', 'Bank & merchant fees', 'variable', true,
   'Bank, card processor and merchant fees on clinic money. Not taxes and not owner draws.'),
  ('building_renovation', 'Building renovation', 'capex', false,
   'One-time build-out, remodel or major repair of the clinic. Not the monthly rent.'),
  ('cleaning', 'Cleaning', 'capex', false,
   'One-off deep clean or move-in cleaning. A recurring cleaning service belongs in Other.'),
  ('electricity', 'Electricity', 'fixed', true,
   'The monthly power bill. Not water, internet, rent or one-off repairs.'),
  ('furniture', 'Furniture & fixtures', 'capex', false,
   'Furniture, fixtures and equipment bought once. Not clinical supplies and not consumables.'),
  ('insurance', 'Insurance', 'fixed', true,
   'Recurring clinic insurance premiums. Not patient balances and not payroll taxes.'),
  ('lab_work', 'Lab work', 'variable', true,
   'Outside laboratory testing invoiced to the clinic. Not in-house supplies or pharmacy.'),
  ('marketing_consulting', 'Marketing consulting', 'acquisition', true,
   'Agency retainer or marketing consultant fees. Not the ad platforms themselves.'),
  ('other', 'Other', 'capex', false,
   'A one-time expense that fits no other concept. If it repeats every month, it is not Other.'),
  ('payroll', 'Staff payroll', 'fixed', true,
   'Assistant and non-owner clinic staff wages. Do not include physician/owner draws here.'),
  ('pharmacy', 'Pharmacy', 'variable', true,
   'Pharmacy and prescription purchases dispensed to patients. Not lab work.'),
  ('products', 'Products', 'variable', true,
   'Clinical supplies and consumables used to deliver treatments. Not equipment or furniture.'),
  ('rent', 'Rent', 'fixed', true,
   'Monthly clinic rent. Not build-out, renovation or a deposit.'),
  ('software', 'Software & subscriptions', 'fixed', true,
   'Software subscriptions and platform fees. Not one-time hardware.'),
  ('sterilization', 'Sterilization', 'fixed', true,
   'Recurring instrument sterilization and reprocessing. Not equipment purchases.'),
  ('taxes', 'Taxes & accounting', 'fixed', true,
   'Accounting, bookkeeping and tax filing fees. Not payroll wages and not owner draws.'),
  ('telecom', 'Telecom & internet', 'fixed', true,
   'Phone and internet service. Not phone or network equipment.'),
  ('training', 'Training & compliance', 'capex', false,
   'One-time courses, certifications or compliance training. Not recurring dues.')
) as v(slug, name, cost_behavior, recurring, guidance)
where i.normalized_name = v.slug;

-- A new concept created from the dialog never had a normalized_name, so the insert
-- failed. Every other catalog table derives it from the name; expenses now do the
-- same, in the slug shape the table already uses. An explicit value wins.
create or replace function public.set_expense_item_normalized_name() returns trigger
language plpgsql as $$
begin
  if new.normalized_name is null or btrim(new.normalized_name) = '' then
    new.normalized_name := regexp_replace(public.normalize_item_name(new.name), '\s+', '_', 'g');
  end if;
  if new.normalized_name = '' then
    raise exception 'the name needs at least one letter or digit' using errcode = '22023';
  end if;
  return new;
end;
$$;

comment on function public.set_expense_item_normalized_name() is
  'Derives the expense concept key from its name when the caller did not supply one.';

drop trigger if exists expense_items_set_normalized_name on public.expense_items;
create trigger expense_items_set_normalized_name
  before insert or update of name on public.expense_items
  for each row execute function public.set_expense_item_normalized_name();

-- 3. The owner's monthly draw becomes its own concept, under the same payroll bucket so
-- the category totals read the same as before.

insert into public.expense_items (name, normalized_name, category_id, recurring, cost_behavior, guidance)
select 'Owner draw',
       'owner_draw',
       c.id,
       true,
       'owner_draw',
       'Physician / clinic owner monthly compensation or draws. Tracked separately so clinic operating profit stays accurate.'
from public.expense_categories c
where c.slug = 'payroll'
on conflict (normalized_name) do update
set name          = excluded.name,
    category_id   = excluded.category_id,
    recurring     = excluded.recurring,
    cost_behavior = excluded.cost_behavior,
    guidance      = excluded.guidance;

-- 4. The historical split: 2880.00 assistant + 12000.00 owner = 14880.00, delta 0.00.
-- The closed months are touched on purpose, so the guard is off for this transaction
-- only; the stored total of each closed month is re-stated from its live lines at the
-- end and must come out identical.

alter table public.expense_entries disable trigger expense_entries_guard;

do $$
declare
  v_owner  uuid;
  r        record;
  v_split  int := 0;
begin
  select id into v_owner from public.expense_items where normalized_name = 'owner_draw';

  for r in
    select e.id, e.period_id
    from public.expense_entries e
    join public.expense_items i on i.id = e.item_id
    join public.expense_periods p on p.id = e.period_id
    where i.normalized_name = 'payroll'
      and e.amount = 14880.00
      and e.voided_at is null
      and p.period between date '2026-05-01' and date '2026-11-01'
    order by p.period
  loop
    update public.expense_entries
    set amount = 2880.00,
        updated_by = 'migration'
    where id = r.id;

    insert into public.expense_entries
      (period_id, item_id, supplier_id, amount, note, created_by)
    values
      (r.period_id, v_owner, null, 12000.00,
       'Owner draw split from the 14880.00 payroll line: 2880.00 assistant + 12000.00 owner.',
       'migration')
    on conflict (period_id, item_id, supplier_id) where voided_at is null
    do update set amount = excluded.amount,
                  note = excluded.note,
                  updated_by = 'migration';

    v_split := v_split + 1;
  end loop;

  if v_split = 0 then
    raise notice 'no payroll line of 14880.00 to split';
  end if;
end;
$$;

-- The closed months keep their stored total; it is restated from the live lines so the
-- split cannot leave C18 behind.
update public.expense_periods p
set total = (
  select coalesce(sum(e.amount), 0)
  from public.expense_entries e
  where e.period_id = p.id and e.voided_at is null
)
where p.status = 'closed';

alter table public.expense_entries enable trigger expense_entries_guard;

-- 5. The batch refuses itself if the historic amount moved or a closed month drifted.

do $$
declare
  v_bad text;
begin
  select string_agg(x.period::text, ', ' order by x.period) into v_bad
  from (
    select p.period,
           sum(e.amount) filter (where i.normalized_name in ('payroll', 'owner_draw')) as split_total
    from public.expense_periods p
    join public.expense_entries e on e.period_id = p.id and e.voided_at is null
    join public.expense_items i on i.id = e.item_id
    where p.period between date '2026-05-01' and date '2026-11-01'
    group by p.period
  ) x
  where x.split_total is distinct from 14880.00;

  if v_bad is not null then
    raise exception 'payroll + owner draw no longer add up to 14880.00 in: %', v_bad;
  end if;

  select string_agg(p.period::text, ', ' order by p.period) into v_bad
  from public.expense_periods p
  where p.status = 'closed'
    and p.total is distinct from (
      select coalesce(sum(e.amount), 0)
      from public.expense_entries e
      where e.period_id = p.id and e.voided_at is null
    );

  if v_bad is not null then
    raise exception 'closed expense totals no longer match their live lines in: %', v_bad;
  end if;
end;
$$;
