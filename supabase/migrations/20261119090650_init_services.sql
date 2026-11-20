-- 20261119090800_init_services.sql
-- Services the med spa orders or performs but that are not treatments and not
-- products: lab work today, whatever comes next by inserting a row.
-- Same shape as treatments on purpose: cost, price and margin work identically.

create table if not exists public.services (
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

comment on table public.services is 'Non-treatment services such as lab work. Grows by inserting rows, no enum to change.';
comment on column public.services.margin is 'price - cost, recomputed by the database whenever either changes.';

insert into public.services (name, normalized_name, cost, price) values
  ('Lab Work', 'lab work', 78.00, 200.00),
  ('Lab Work - Extended Panel', 'lab work extended panel', 97.50, null)
on conflict (normalized_name) do nothing;
