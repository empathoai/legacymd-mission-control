-- 20261119090300_init_treatments.sql
-- Catalog of what the med spa sells. Packages are not decomposed into their
-- components: the owner prices the package, and the catalog stores it as one row.

create table if not exists public.treatments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  normalized_name     text not null unique,
  cost                numeric(10,2) check (cost >= 0),
  price               numeric(10,2) check (price >= 0),
  margin              numeric(10,2) generated always as (price - cost) stored,
  default_category_id uuid references public.categories(id) on delete set null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

comment on table public.treatments is 'Sellable treatments and packages, with cost and list price.';
comment on column public.treatments.cost is 'What the treatment costs the business. Null when the owner has not recorded it.';
comment on column public.treatments.price is 'Default sale price. The sale can charge a different amount.';
comment on column public.treatments.margin is 'price - cost, recomputed by the database whenever either changes. Null while either is unknown.';
comment on column public.treatments.default_category_id is 'Suggested category when this treatment is picked. The sale owns the real value.';

create index if not exists treatments_default_category_idx on public.treatments (default_category_id);
