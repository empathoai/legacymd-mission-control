-- 20261119090450_init_products.sql
-- Sellable products (supplements, serums, add-ons). No inventory: only what is
-- charged. `price` is a default, the sale line stores the amount actually paid.

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  normalized_name     text not null unique,
  price               numeric(10,2) check (price >= 0),
  cost                numeric(10,2) check (cost >= 0),
  default_category_id uuid references public.categories(id) on delete set null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

comment on table public.products is 'Products sold alongside treatments. No stock tracking in the MVP.';
comment on column public.products.default_category_id is 'Suggested category when this product is picked. The sale line owns the real value.';
