-- 20261119092400_treatment_unit_type.sql
-- A catalog row can be one treatment or a bundle of them. Same table, different
-- nature: a package has its own price and its own margin, and cannot be compared
-- one-to-one with a single Botox.

alter table public.treatments
  add column if not exists unit_type text not null default 'unit'
  check (unit_type in ('unit', 'package'));

comment on column public.treatments.unit_type is 'unit = one treatment, package = bundle of sessions or products sold as one price.';

update public.treatments
set unit_type = 'package'
where normalized_name in (
  '2 iv 4 lipotropic',
  '4 ivs 4 lipotropic package',
  '4 ivs 6 lipotropic package arum',
  'botox membership',
  'eterna iv series membership',
  'enclomiphen package',
  'iv series',
  'peptide ivs packages',
  'nad iv series protocol',
  'testosterone optimization protocol',
  'testosterone optimization protocol injectable',
  'weight loss package w semaglutide',
  'weight loss packages w tirzepatide',
  'legacymen 360 energia rendimiento',
  'regenerative glow protocol for annette',
  'energy precision endo flow ivs series'
);
