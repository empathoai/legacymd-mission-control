-- 20261119090400_seed_treatments.sql
-- 35 treatments from the `TreatmentsProducts` sheet: cost as recorded by the owner,
-- price as the most common unit value actually charged in the workbook.
-- `default_category_id` is only seeded where one category covers >= 80% of that
-- treatment's sales; everywhere else the sale still picks the category.

insert into public.treatments (name, normalized_name, cost, price, default_category_id)
select v.name, v.normalized_name, v.cost, v.price, c.id
from (values
  ('Weight Loss Packages w/ Tirzepatide', 'weight loss packages w tirzepatide', 490.00, 495.00, 'weight_loss'),
  ('Male Optimization - Timmix', 'male optimization timmix', 244.00, 250.00, 'mens_health'),
  ('IV Series', 'iv series', 150.00, 1044.00, null),
  ('Botox Membership', 'botox membership', 900.00, null, null),
  ('Enclomiphen Package', 'enclomiphen package', 75.00, 150.00, 'mens_health'),
  ('Botox Treatment', 'botox treatment', 220.00, 600.00, 'aesthetics'),
  ('Lip Filler', 'lip filler', 130.00, null, null),
  ('Under-Eye-Treatment', 'under eye treatment', 80.00, 170.00, 'aesthetics'),
  ('IV Single', 'iv single', 50.00, 290.00, 'performance'),
  ('Microneedling Treatment', 'microneedling treatment', 20.00, 108.00, 'aesthetics'),
  ('Consultation', 'consultation', 75.00, 120.00, null),
  ('WL GLP-1 Monthly Treatment Supply Tirzepatide', 'wl glp 1 monthly treatment supply tirzepatide', 185.00, 500.00, 'weight_loss'),
  ('Weight Loss Package w/ Semaglutide', 'weight loss package w semaglutide', 195.00, 378.00, 'weight_loss'),
  ('Vitamine Injections', 'vitamine injections', 4.00, null, null),
  ('Lipotropic Injection', 'lipotropic injection', 4.00, null, null),
  ('WL GLP-1 Monthly Treatment Supply Semaglutide', 'wl glp 1 monthly treatment supply semaglutide', 59.00, 250.00, 'weight_loss'),
  ('Filler Syringe', 'filler syringe', 260.00, 495.00, 'aesthetics'),
  ('Scalp Injections w/ Exosomes', 'scalp injections w exosomes', 150.00, 600.00, null),
  ('Quemical Peel', 'quemical peel', 22.00, 110.00, null),
  ('Ipamorelin CJC Troche', 'ipamorelin cjc troche', 150.00, 300.00, null),
  ('NAD +', 'nad', 74.00, 260.00, null),
  ('Biostimulator', 'biostimulator', 570.00, 1037.50, 'aesthetics'),
  ('Medicine Consult', 'medicine consult', 120.00, 150.00, null),
  ('Testosterone Optimization Protocol Injectable', 'testosterone optimization protocol injectable', 48.00, null, null),
  ('Eterna IV Series Membership', 'eterna iv series membership', 300.00, 135.00, null),
  ('4 IVs + 6 Lipotropic Package + Arum', '4 ivs 6 lipotropic package arum', 287.00, null, null),
  ('NoxSynergy', 'noxsynergy', 43.00, 87.00, 'mens_health'),
  ('Arum Fresh', 'arum fresh', 43.00, 82.00, 'weight_loss'),
  ('LegacyMen 360. Energia. Rendimiento', 'legacymen 360 energia rendimiento', 760.00, 797.00, 'weight_loss'),
  ('2 IV + 4 Lipotropic', '2 iv 4 lipotropic', 126.00, null, null),
  ('NAD+ IV Series Protocol', 'nad iv series protocol', null, 441.00, null),
  ('Peptide/IVs Packages', 'peptide ivs packages', null, 694.00, 'performance'),
  ('Energy Precision Endo/Flow - $ IVs series', 'energy precision endo flow ivs series', null, 311.00, 'mens_health')
) as v(name, normalized_name, cost, price, category_slug)
left join public.categories c on c.slug = v.category_slug
on conflict (normalized_name) do nothing;

