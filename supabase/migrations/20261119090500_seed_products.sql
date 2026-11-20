-- 20261119090500_seed_products.sql
-- 33 products from the `Products` column of the source workbook.
-- `price` is the most common unit value charged. `default_category_id` is seeded
-- only when one category covers >= 80% of that product's sales.

insert into public.products (name, normalized_name, price, default_category_id)
select v.name, v.normalized_name, v.price, c.id
from (values
  ('Perform Supplement', 'perform supplement', 50.00, null),
  ('NAD+ therapy', 'nad therapy', 260.00, null),
  ('Biotin', 'biotin', 50.00, 'aesthetics'),
  ('Exosomes', 'exosomes', 150.00, 'aesthetics'),
  ('Gluthation Shot', 'gluthation shot', 50.00, 'aesthetics'),
  ('Factor G Serum  - Skin Care', 'factor g serum skin care', 70.00, null),
  ('IV Add-On Circulate', 'iv add on circulate', 50.00, null),
  ('Remaining Balance', 'remaining balance', 731.00, null),
  ('Vitamine Shots', 'vitamine shots', 40.00, null),
  ('Ipamorelin CJC Injectable', 'ipamorelin cjc injectable', 280.00, null),
  ('Ipamorelin CJC Troches', 'ipamorelin cjc troches', null, null),
  ('Testosterone Cream', 'testosterone cream', 125.00, null),
  ('Lip Filler', 'lip filler', 375.00, 'aesthetics'),
  ('Non-Surgical Rhinoplasty', 'non surgical rhinoplasty', 460.00, null),
  ('Lipotropic IM', 'lipotropic im', 50.00, 'weight_loss'),
  ('Sculptra', 'sculptra', 1400.00, null),
  ('Payment completion from another treat.', 'payment completion from another treat', 362.00, null),
  ('Arum Fresh', 'arum fresh', 82.00, 'weight_loss'),
  ('Arum Microbiota', 'arum microbiota', 72.00, 'weight_loss'),
  ('NoxSynergy', 'noxsynergy', 87.00, 'mens_health'),
  ('Testosterone Injecyable', 'testosterone injecyable', 238.50, null),
  ('IV Endo Flow', 'iv endo flow', null, null),
  ('Enclomiphen', 'enclomiphen', 150.00, 'weight_loss'),
  ('Payment applied to House Credit from other treatment', 'payment applied to house credit from other treatment', 400.00, null),
  ('LibidoStim F', 'libidostim f', null, null),
  ('Insomnitol', 'insomnitol', 50.00, null),
  ('Single IV', 'single iv', null, null),
  ('Arum Vital', 'arum vital', 82.00, null),
  ('Botox', 'botox', 720.00, null),
  ('Arum Life', 'arum life', 82.00, null),
  ('FemGuard', 'femguard', 50.00, null)
) as v(name, normalized_name, price, category_slug)
left join public.categories c on c.slug = v.category_slug
on conflict (normalized_name) do nothing;
