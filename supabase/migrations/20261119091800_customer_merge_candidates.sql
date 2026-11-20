-- 20261119091800_customer_merge_candidates.sql
-- Suspected duplicate patients, one row per group. They are NOT merged: each
-- spelling is currently its own customer, which inflates the new-patient count.
-- The owner confirms a group -> the app merges it; rejecting it keeps them apart.

create table if not exists public.customer_merge_candidates (
  id            uuid primary key default gen_random_uuid(),
  proposed_name text not null,
  variants      text[] not null,
  evidence      text,
  status        text not null default 'pending' check (status in ('pending', 'merged', 'rejected')),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (proposed_name)
);

comment on table public.customer_merge_candidates is 'Groups of name spellings that look like one patient. Merging is a human decision.';

insert into public.customer_merge_candidates (proposed_name, variants, evidence) values
  ('Vicky Zerolo', array['Vicky Zerolo', 'Victoria Zerolo'], 'Nickname: same patient, same card'),
  ('Javier Marin', array['Javier Marin', 'Javier Marin Rey'], 'Same IV Series, June to September'),
  ('Tony Rotella', array['Tony Rotella', 'Antono Rotella'], 'Monthly GLP-1, same payment method'),
  ('Janet Ojeda', array['Janet Ojeda', 'Yanet Ojeda'], 'Same 495 package, same visit sequence'),
  ('Beatriz Cesar', array['Beatriz Cesar', 'Ramona B. Cesar', 'Ramona Beatriz Cesar'], 'Same monthly series, same WL package'),
  ('Frank Moreno', array['Frank Moreno', 'Frank Moreno Navarro'], 'Same Energy Precision line'),
  ('Juan Pablo Moran', array['Juan P. Moran', 'Juan Pablo Moran'], 'Same Weight Loss Package w/ Semaglutide'),
  ('Claudia Rodriguez', array['Claudia Rodriguez', 'Ma. Claudia Rodguez'], 'Botox and Biostimulator, same closing dates'),
  ('Annette Danese', array['Annette Danase', 'Annette Denise', 'Annette Danese'], 'DOUBTFUL: Denise and Danese may be different surnames'),
  ('Vasilia Nickles', array['Vasilia Nickles', 'Vesalia Nichols'], 'DOUBTFUL: first and last name change, same service'),
  ('Ramon Adrian Rodriguez', array['Adrian Ramon', 'Adrian Rodriguez', 'Ramon Adrian Rodriguez'], 'DOUBTFUL: the name order changes')
on conflict (proposed_name) do nothing;
