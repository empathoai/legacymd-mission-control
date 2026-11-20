-- 20261119091400_init_expenses.sql
-- Expenses as accounting masters, rebuilt from the workbook's side column.
--   expense_categories : the accounting bucket, mandatory on every concept
--   suppliers          : who gets paid
--   expense_items      : the concept, always categorised, optional default supplier
--   expense_entries    : period + concept + supplier + amount
-- Rebuilt from scratch on purpose: the first version mixed concepts and vendors.

drop view if exists public.monthly_balance;
drop view if exists public.expense_by_category;
drop trigger if exists expense_entries_guard on public.expense_entries;
drop function if exists public.guard_closed_expense_period();
drop table if exists public.expense_entries;
drop table if exists public.expense_periods;
drop table if exists public.expense_items;
drop table if exists public.expense_categories;
drop table if exists public.suppliers;

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  sort_order smallint not null default 0
);

create table public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null unique,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.expense_items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  normalized_name     text not null unique,
  category_id         uuid not null references public.expense_categories(id) on delete restrict,
  default_supplier_id uuid references public.suppliers(id) on delete set null,
  recurring           boolean not null default true,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table public.expense_periods (
  id         uuid primary key default gen_random_uuid(),
  period     date not null unique,
  status     text not null default 'open' check (status in ('open', 'closed')),
  closed_at  timestamptz,
  total      numeric(12,2),
  created_at timestamptz not null default now(),
  constraint closed_period_has_date check ((status = 'closed') = (closed_at is not null))
);

create table public.expense_entries (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references public.expense_periods(id) on delete restrict,
  item_id     uuid not null references public.expense_items(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  amount      numeric(12,2) not null check (amount >= 0),
  note        text,
  created_at  timestamptz not null default now(),
  unique nulls not distinct (period_id, item_id, supplier_id)
);

comment on table public.expense_items is 'Accounting concept. Category is mandatory: an uncategorised expense is not a balance.';
comment on table public.suppliers is 'Vendors. Grows by inserting rows from the expense form.';
comment on table public.expense_entries is 'Amount per period, concept and supplier.';

insert into public.expense_categories (slug, label, sort_order) values
  ('facilities', 'Facilities', 10),
  ('utilities', 'Utilities', 20),
  ('technology', 'Technology & software', 25),
  ('operations', 'Operations', 30),
  ('payroll', 'Payroll & Taxes', 40),
  ('marketing', 'Marketing', 50),
  ('products', 'Products', 60),
  ('insurance', 'Insurance', 70),
  ('financial', 'Financial & Other', 80);

insert into public.suppliers (name, normalized_name) values
  ('Adobe', 'adobe'),
  ('Amazon', 'amazon'),
  ('AndaMeds', 'andameds'),
  ('Arum', 'arum'),
  ('AT&T', 'att'),
  ('DERMA M', 'derma_m'),
  ('Designs for Health', 'designs_for_health'),
  ('Doris (taxes)', 'doris'),
  ('Fabian', 'fabian'),
  ('FPL', 'fpl'),
  ('Frida', 'frida'),
  ('Genesis Medical Lab', 'genesis_medical_lab'),
  ('Hallandale Pharmacy', 'hallandale_pharmacy'),
  ('HeyGen', 'heygen'),
  ('Meta', 'meta'),
  ('Muebles', 'muebles'),
  ('Olympia', 'olympia'),
  ('Practice Fusion', 'practice_fusion'),
  ('Premium', 'premium'),
  ('Rapid Bio Lab', 'rapid_bio_lab'),
  ('Sterycicle', 'sterycicle'),
  ('Synovus', 'synovus'),
  ('U-Line', 'u_line');

insert into public.expense_items (name, normalized_name, category_id, recurring)
select v.name, v.slug, c.id, v.recurring
from (values
  ('Advertising', 'advertising', 'marketing', true),
  ('Bank & merchant fees', 'bank_fees', 'financial', true),
  ('Building renovation', 'building_renovation', 'facilities', false),
  ('Cleaning', 'cleaning', 'facilities', false),
  ('Electricity', 'electricity', 'utilities', true),
  ('Furniture & fixtures', 'furniture', 'facilities', false),
  ('Insurance', 'insurance', 'insurance', true),
  ('Lab work', 'lab_work', 'operations', true),
  ('Marketing consulting', 'marketing_consulting', 'marketing', true),
  ('Other', 'other', 'financial', false),
  ('Payroll', 'payroll', 'payroll', true),
  ('Pharmacy', 'pharmacy', 'operations', true),
  ('Products', 'products', 'products', true),
  ('Rent', 'rent', 'facilities', true),
  ('Software & subscriptions', 'software', 'technology', true),
  ('Sterilization', 'sterilization', 'operations', true),
  ('Taxes & accounting', 'taxes', 'payroll', true),
  ('Telecom & internet', 'telecom', 'utilities', true),
  ('Training & compliance', 'training', 'operations', false)
) as v(name, slug, category_slug, recurring)
join public.expense_categories c on c.slug = v.category_slug;

insert into public.expense_periods (period, status, closed_at)
select v.period,
       case when v.period < date '2026-11-01' then 'closed' else 'open' end,
       case when v.period < date '2026-11-01' then now() end
from (values ('2026-05-01'::date), ('2026-06-01'::date), ('2026-07-01'::date), ('2026-08-01'::date), ('2026-09-01'::date), ('2026-10-01'::date), ('2026-11-01'::date)) as v(period);

insert into public.expense_entries (period_id, item_id, supplier_id, amount)
select p.id, i.id, s.id, v.amount
from (values
  ('2026-05-01'::date, 'advertising', 'meta', 1589.58),
  ('2026-05-01'::date, 'bank_fees', 'synovus', 1177.00),
  ('2026-05-01'::date, 'cleaning', null, 200.00),
  ('2026-05-01'::date, 'electricity', 'fpl', 150.00),
  ('2026-05-01'::date, 'insurance', null, 120.00),
  ('2026-05-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-05-01'::date, 'payroll', null, 14880.00),
  ('2026-05-01'::date, 'products', null, 10294.34),
  ('2026-05-01'::date, 'rent', null, 6096.54),
  ('2026-05-01'::date, 'software', 'adobe', 20.00),
  ('2026-05-01'::date, 'sterilization', 'sterycicle', 156.28),
  ('2026-05-01'::date, 'telecom', 'att', 280.00),
  ('2026-06-01'::date, 'advertising', 'meta', 1315.00),
  ('2026-06-01'::date, 'bank_fees', 'synovus', 1200.00),
  ('2026-06-01'::date, 'electricity', 'fpl', 186.00),
  ('2026-06-01'::date, 'insurance', null, 120.00),
  ('2026-06-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-06-01'::date, 'payroll', null, 14880.00),
  ('2026-06-01'::date, 'products', null, 7549.00),
  ('2026-06-01'::date, 'rent', null, 6096.54),
  ('2026-06-01'::date, 'software', 'adobe', 20.00),
  ('2026-06-01'::date, 'sterilization', 'sterycicle', 156.28),
  ('2026-06-01'::date, 'telecom', 'att', 280.00),
  ('2026-07-01'::date, 'advertising', 'meta', 1230.00),
  ('2026-07-01'::date, 'bank_fees', 'synovus', 850.00),
  ('2026-07-01'::date, 'electricity', 'fpl', 246.83),
  ('2026-07-01'::date, 'insurance', null, 120.00),
  ('2026-07-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-07-01'::date, 'payroll', null, 14880.00),
  ('2026-07-01'::date, 'products', null, 7423.45),
  ('2026-07-01'::date, 'products', 'derma_m', 1200.00),
  ('2026-07-01'::date, 'rent', null, 6096.54),
  ('2026-07-01'::date, 'software', 'adobe', 20.00),
  ('2026-07-01'::date, 'sterilization', 'sterycicle', 156.28),
  ('2026-07-01'::date, 'telecom', 'att', 280.00),
  ('2026-08-01'::date, 'advertising', 'meta', 1092.00),
  ('2026-08-01'::date, 'bank_fees', 'synovus', 850.00),
  ('2026-08-01'::date, 'electricity', 'fpl', 397.93),
  ('2026-08-01'::date, 'furniture', 'muebles', 500.00),
  ('2026-08-01'::date, 'insurance', null, 120.00),
  ('2026-08-01'::date, 'lab_work', 'genesis_medical_lab', 578.00),
  ('2026-08-01'::date, 'lab_work', 'rapid_bio_lab', 286.05),
  ('2026-08-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-08-01'::date, 'other', null, 280.00),
  ('2026-08-01'::date, 'payroll', null, 14880.00),
  ('2026-08-01'::date, 'products', null, 8338.31),
  ('2026-08-01'::date, 'rent', null, 6096.54),
  ('2026-08-01'::date, 'software', 'adobe', 20.00),
  ('2026-08-01'::date, 'sterilization', 'sterycicle', 156.28),
  ('2026-08-01'::date, 'telecom', 'att', 280.00),
  ('2026-09-01'::date, 'advertising', 'meta', 1233.00),
  ('2026-09-01'::date, 'bank_fees', 'synovus', 850.00),
  ('2026-09-01'::date, 'electricity', 'fpl', 346.00),
  ('2026-09-01'::date, 'furniture', 'muebles', 500.00),
  ('2026-09-01'::date, 'insurance', null, 120.00),
  ('2026-09-01'::date, 'lab_work', 'genesis_medical_lab', 1562.00),
  ('2026-09-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-09-01'::date, 'payroll', null, 14880.00),
  ('2026-09-01'::date, 'products', null, 7769.15),
  ('2026-09-01'::date, 'rent', null, 6091.96),
  ('2026-09-01'::date, 'software', 'adobe', 20.00),
  ('2026-09-01'::date, 'software', 'practice_fusion', 150.00),
  ('2026-09-01'::date, 'sterilization', 'sterycicle', 156.28),
  ('2026-09-01'::date, 'telecom', 'att', 280.00),
  ('2026-10-01'::date, 'advertising', 'meta', 1166.23),
  ('2026-10-01'::date, 'bank_fees', 'synovus', 0.00),
  ('2026-10-01'::date, 'building_renovation', null, 2146.89),
  ('2026-10-01'::date, 'electricity', 'fpl', 267.00),
  ('2026-10-01'::date, 'furniture', 'muebles', 0.00),
  ('2026-10-01'::date, 'insurance', null, 120.00),
  ('2026-10-01'::date, 'lab_work', 'genesis_medical_lab', 663.59),
  ('2026-10-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-10-01'::date, 'other', null, 200.50),
  ('2026-10-01'::date, 'payroll', null, 14880.00),
  ('2026-10-01'::date, 'pharmacy', 'hallandale_pharmacy', 1083.00),
  ('2026-10-01'::date, 'products', null, 11041.68),
  ('2026-10-01'::date, 'rent', null, 6088.11),
  ('2026-10-01'::date, 'software', 'adobe', 20.00),
  ('2026-10-01'::date, 'software', 'heygen', 99.00),
  ('2026-10-01'::date, 'software', 'practice_fusion', 170.00),
  ('2026-10-01'::date, 'sterilization', 'sterycicle', 161.00),
  ('2026-10-01'::date, 'taxes', 'doris', 2200.00),
  ('2026-10-01'::date, 'telecom', 'att', 280.00),
  ('2026-10-01'::date, 'training', null, 295.00),
  ('2026-11-01'::date, 'bank_fees', 'synovus', 0.00),
  ('2026-11-01'::date, 'electricity', 'fpl', 242.78),
  ('2026-11-01'::date, 'furniture', 'muebles', 500.00),
  ('2026-11-01'::date, 'insurance', null, 110.00),
  ('2026-11-01'::date, 'lab_work', 'genesis_medical_lab', 2373.50),
  ('2026-11-01'::date, 'marketing_consulting', null, 1700.00),
  ('2026-11-01'::date, 'other', null, 70.09),
  ('2026-11-01'::date, 'payroll', null, 14880.00),
  ('2026-11-01'::date, 'products', null, 3265.34),
  ('2026-11-01'::date, 'rent', null, 6091.96),
  ('2026-11-01'::date, 'software', 'adobe', 20.00),
  ('2026-11-01'::date, 'software', 'heygen', 99.00),
  ('2026-11-01'::date, 'software', 'practice_fusion', 170.00),
  ('2026-11-01'::date, 'sterilization', 'sterycicle', 161.00),
  ('2026-11-01'::date, 'telecom', 'att', 280.00)
) as v(period, item_slug, supplier_slug, amount)
join public.expense_periods p on p.period = v.period
join public.expense_items i on i.normalized_name = v.item_slug
left join public.suppliers s on s.normalized_name = v.supplier_slug;

update public.expense_periods p
set total = (select coalesce(sum(amount), 0) from public.expense_entries e where e.period_id = p.id)
where p.status = 'closed';

create or replace function public.guard_closed_expense_period() returns trigger
language plpgsql as $$
declare target uuid;
begin
  target := coalesce(case when tg_op = 'DELETE' then old.period_id else new.period_id end, old.period_id);
  if exists (select 1 from public.expense_periods p where p.id = target and p.status = 'closed') then
    raise exception 'expense period is closed; reopen it before editing entries';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger expense_entries_guard
before insert or update or delete on public.expense_entries
for each row execute function public.guard_closed_expense_period();

create view public.expense_by_category as
select p.period as month, c.slug as category, c.label, sum(e.amount)::numeric(12,2) as amount
from public.expense_entries e
join public.expense_periods p on p.id = e.period_id
join public.expense_items i on i.id = e.item_id
join public.expense_categories c on c.id = i.category_id
group by 1, 2, 3
order by 1, 2;

create view public.monthly_balance as
with revenue as (
  select date_trunc('month', occurred_on)::date as month, sum(total) as amount
  from public.sales_with_totals group by 1
), spend as (
  select p.period as month, sum(e.amount) as amount
  from public.expense_periods p join public.expense_entries e on e.period_id = p.id
  group by 1
)
select coalesce(r.month, s.month) as month,
       coalesce(r.amount, 0)::numeric(12,2) as revenue,
       coalesce(s.amount, 0)::numeric(12,2) as expenses,
       (coalesce(r.amount, 0) - coalesce(s.amount, 0))::numeric(12,2) as balance
from revenue r full join spend s on s.month = r.month
order by 1;
