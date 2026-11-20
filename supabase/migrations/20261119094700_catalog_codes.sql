-- 094700_catalog_codes.sql
-- Every catalog item needs a stable, human-readable identifier: the owner says "PROD-0012",
-- not a UUID. The UUID stays the internal key that costs, prices and sale lines reference;
-- the code is what a person reads, exports and searches.
--
-- Codes are assigned once, never reused, and prefixed by kind so a code alone says what it
-- is: TRT- for treatments, PROD- for products, SRV- for services.

alter table public.treatments add column if not exists code text;
alter table public.products   add column if not exists code text;
alter table public.services   add column if not exists code text;

with numbered as (
  select id, row_number() over (order by name, id) as rn
  from public.treatments where code is null
)
update public.treatments t
set code = 'TRT-' || lpad(n.rn::text, 4, '0')
from numbered n where n.id = t.id;

with numbered as (
  select id, row_number() over (order by name, id) as rn
  from public.products where code is null
)
update public.products p
set code = 'PROD-' || lpad(n.rn::text, 4, '0')
from numbered n where n.id = p.id;

with numbered as (
  select id, row_number() over (order by name, id) as rn
  from public.services where code is null
)
update public.services s
set code = 'SRV-' || lpad(n.rn::text, 4, '0')
from numbered n where n.id = s.id;

alter table public.treatments alter column code set not null;
alter table public.products   alter column code set not null;
alter table public.services   alter column code set not null;

alter table public.treatments drop constraint if exists treatments_code_key;
alter table public.treatments add constraint treatments_code_key unique (code);
alter table public.products   drop constraint if exists products_code_key;
alter table public.products   add constraint products_code_key unique (code);
alter table public.services   drop constraint if exists services_code_key;
alter table public.services   add constraint services_code_key unique (code);

comment on column public.treatments.code is
  'Stable human-readable identifier, assigned once and never reused. The UUID stays the internal key.';
comment on column public.products.code is
  'Stable human-readable identifier, assigned once and never reused. The UUID stays the internal key.';
comment on column public.services.code is
  'Stable human-readable identifier, assigned once and never reused. The UUID stays the internal key.';

create view public.catalog_items with (security_invoker = true) as
select
  'treatment'::text                                    as item_kind,
  t.id                                                  as item_id,
  t.code,
  t.name,
  t.price,
  public.cost_on('treatment', t.id, current_date)       as current_cost,
  t.active
from public.treatments t
union all
select
  'product'::text,
  p.id,
  p.code,
  p.name,
  p.price,
  public.cost_on('product', p.id, current_date),
  p.active
from public.products p
union all
select
  'service'::text,
  s.id,
  s.code,
  s.name,
  s.price,
  public.cost_on('service', s.id, current_date),
  s.active
from public.services s;

comment on view public.catalog_items is
  'One row per sellable catalog item with its code, list price and the cost in force today. The sale form and the reports read this.';
