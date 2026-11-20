-- 20261119090100_init_customers.sql
-- One row per patient. `normalized_name` is the dedupe key: the source workbook
-- had 236 spellings for what turned out to be 201 people.

create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  normalized_name text not null unique,
  aliases         text[] not null default '{}',
  created_at      timestamptz not null default now()
);

comment on column public.customers.normalized_name is 'Lowercase, accent-free, punctuation-free name used to detect duplicates.';
comment on column public.customers.aliases is 'Spellings seen in the source data that map to this person, e.g. Sandea Desme.';

create index if not exists customers_full_name_idx on public.customers (full_name);
