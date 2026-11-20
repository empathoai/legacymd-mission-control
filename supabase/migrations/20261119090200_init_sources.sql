-- 20261119090200_init_sources.sql
-- How the patient found the med spa. Seven raw spellings in the workbook
-- collapse to five sources (`Website` and `website` are the same channel).

create table if not exists public.sources (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.sources is 'Acquisition channel for a sale: referral, instagram, facebook, groupon, website.';

insert into public.sources (slug, label, sort_order) values
  ('referral',  'Referral',  10),
  ('instagram', 'Instagram', 20),
  ('facebook',  'Facebook',  30),
  ('groupon',   'Groupon',   40),
  ('website',   'Website',   50)
on conflict (slug) do nothing;
