-- 20261119090000_init_categories.sql
-- Lookup table for the four sale categories the med spa uses.
-- Category is a property of the sale, not of the service: 11 of 34 services
-- appear under more than one category in the source workbook.

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Sale categories: weight loss, men''s health, aesthetics, performance.';
comment on column public.categories.slug is 'Stable machine key, e.g. weight_loss.';
comment on column public.categories.label is 'Human label shown in the UI.';

insert into public.categories (slug, label, sort_order) values
  ('weight_loss', 'Weight Loss',  10),
  ('mens_health', 'Men''s Health', 20),
  ('aesthetics',  'Aesthetics',   30),
  ('performance', 'Performance',  40)
on conflict (slug) do nothing;
