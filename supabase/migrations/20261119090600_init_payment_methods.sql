-- 20261119090600_init_payment_methods.sql
-- How the patient paid. Seven spellings in the workbook collapse to seven methods
-- (`Caren Credit` is Care Credit).

create table if not exists public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into public.payment_methods (slug, label, sort_order) values
  ('credit',      'Credit',      10),
  ('stripe',      'Stripe',      20),
  ('cash',        'Cash',        30),
  ('zelle',       'Zelle',       40),
  ('cherry',      'Cherry',      50),
  ('groupon',     'Groupon',     60),
  ('care_credit', 'Care Credit', 70)
on conflict (slug) do nothing;
