-- 20261119090700_init_sales.sql
-- A sale is one visit: one patient, one date, one payment. What was sold lives in
-- sale_items, so a visit with three treatments is one row here and three there.
-- This is the problem the workbook has: it forces one row per treatment and loses
-- the fact that they were the same visit.

create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  occurred_on    date not null,
  customer_id    uuid not null references public.customers(id) on delete restrict,
  source_id      uuid references public.sources(id) on delete set null,
  is_first_visit boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now()
);

comment on table public.sales is 'One row per visit. Items are in sale_items, money is in sale_payments.';
comment on column public.sales.source_id is 'Acquisition channel. Only meaningful when is_first_visit is true.';
comment on column public.sales.is_first_visit is 'True when this is the customer''s first ever purchase. New-patient counts rely on it.';

create index if not exists sales_occurred_on_idx on public.sales (occurred_on);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists sales_first_visit_idx on public.sales (is_first_visit) where is_first_visit;

create table if not exists public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete restrict,
  product_id   uuid references public.products(id) on delete restrict,
  service_id   uuid references public.services(id) on delete restrict,
  category_id  uuid references public.categories(id) on delete set null,
  description  text,
  quantity     numeric(10,2) not null default 1 check (quantity > 0),
  unit_price   numeric(10,2) not null check (unit_price >= 0),
  line_total   numeric(12,2) generated always as (quantity * unit_price) stored,
  constraint sale_item_has_one_subject check (
    (treatment_id is not null)::int
    + (product_id is not null)::int
    + (service_id is not null)::int
    + (description is not null)::int = 1
  )
);

comment on table public.sale_items is 'One row per thing sold within a visit.';
comment on column public.sale_items.category_id is 'Category of this line, so revenue splits by category even when a visit mixes a treatment and a product. Defaulted from the item, editable per line.';
comment on column public.sale_items.unit_price is 'Amount actually charged, defaulted from the catalog and editable at sale time.';
comment on column public.sale_items.line_total is 'quantity * unit_price, computed by the database.';

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);
create index if not exists sale_items_treatment_idx on public.sale_items (treatment_id);
create index if not exists sale_items_category_idx on public.sale_items (category_id);

create or replace view public.revenue_by_category as
select
  date_trunc('month', s.occurred_on)::date as month,
  c.slug as category_slug,
  count(*) as lines,
  sum(i.line_total)::numeric(12,2) as revenue
from public.sale_items i
join public.sales s on s.id = i.sale_id
left join public.categories c on c.id = i.category_id
group by 1, 2;

comment on view public.revenue_by_category is 'Revenue per category per month, with product and treatment lines counted together.';

create or replace view public.sales_with_totals as
select
  s.id,
  s.occurred_on,
  s.customer_id,
  s.source_id,
  s.is_first_visit,
  s.notes,
  coalesce(sum(i.line_total), 0)::numeric(12,2) as total
from public.sales s
left join public.sale_items i on i.sale_id = s.id
group by s.id;

comment on view public.sales_with_totals is 'Visit total computed from its items; never stored twice.';
