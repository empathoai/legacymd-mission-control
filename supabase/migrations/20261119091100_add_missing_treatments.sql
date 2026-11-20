-- 20261119091100_add_missing_treatments.sql
-- The workbook has two disjoint lists on `TreatmentsProducts`: column A is the
-- catalog (36 names) and column G is the cost list (35 names). Six catalog names
-- had no cost row, so they never entered the seed. They are real, sold treatments.

insert into public.treatments (name, normalized_name, cost, price)
values
  ('4 IVs + 4 Lipotropic Package', '4 ivs 4 lipotropic package', null, 357.00),
  ('Insomnitol', 'insomnitol', null, null),
  ('Lipotropic Inyections', 'lipotropic inyections', null, 40.00),
  ('Radiesse', 'radiesse', null, 1250.00),
  ('Regenerative Glow Protocol for Annette', 'regenerative glow protocol for annette', null, 1357.50),
  ('Testosterone Optimization Protocol', 'testosterone optimization protocol', null, 245.00)
on conflict (normalized_name) do nothing;
