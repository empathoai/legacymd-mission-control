-- 20261119091700_estimated_costs.sql
-- Placeholder costs for the owner to replace with real invoice figures.
-- The values are literal data, written one row at a time: no formula, no trigger,
-- nothing that recalculates them. Margin is derived elsewhere (price - cost).
-- Flow: the owner edits the cost in the app; `cost_is_estimated` then goes false.

alter table public.products   add column if not exists cost_is_estimated boolean not null default false;
alter table public.services   add column if not exists cost_is_estimated boolean not null default false;
alter table public.treatments add column if not exists cost_is_estimated boolean not null default false;

comment on column public.products.cost_is_estimated is 'True while the cost is a placeholder typed by hand; the owner replaces it with the invoice figure.';
comment on column public.services.cost_is_estimated is 'True while the cost is a placeholder typed by hand.';
comment on column public.treatments.cost_is_estimated is 'True while the cost is a placeholder typed by hand.';

update public.products set cost = 57.40, cost_is_estimated = true where normalized_name = 'arum fresh';
update public.products set cost = 57.40, cost_is_estimated = true where normalized_name = 'arum life';
update public.products set cost = 50.40, cost_is_estimated = true where normalized_name = 'arum microbiota';
update public.products set cost = 57.40, cost_is_estimated = true where normalized_name = 'arum vital';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'biotin';
update public.products set cost = 504.00, cost_is_estimated = true where normalized_name = 'botox';
update public.products set cost = 105.00, cost_is_estimated = true where normalized_name = 'enclomiphen';
update public.products set cost = 105.00, cost_is_estimated = true where normalized_name = 'exosomes';
update public.products set cost = 49.00, cost_is_estimated = true where normalized_name = 'factor g serum skin care';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'femguard';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'gluthation shot';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'insomnitol';
update public.products set cost = 196.00, cost_is_estimated = true where normalized_name = 'ipamorelin cjc injectable';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'iv add on circulate';
update public.products set cost = 262.50, cost_is_estimated = true where normalized_name = 'lip filler';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'lipotropic im';
update public.products set cost = 182.00, cost_is_estimated = true where normalized_name = 'nad therapy';
update public.products set cost = 322.00, cost_is_estimated = true where normalized_name = 'non surgical rhinoplasty';
update public.products set cost = 60.90, cost_is_estimated = true where normalized_name = 'noxsynergy';
update public.products set cost = 35.00, cost_is_estimated = true where normalized_name = 'perform supplement';
update public.products set cost = 980.00, cost_is_estimated = true where normalized_name = 'sculptra';
update public.products set cost = 87.50, cost_is_estimated = true where normalized_name = 'testosterone cream';
update public.products set cost = 166.95, cost_is_estimated = true where normalized_name = 'testosterone injecyable';
update public.products set cost = 28.00, cost_is_estimated = true where normalized_name = 'vitamine shots';
update public.treatments set cost = 249.90, cost_is_estimated = true where normalized_name = '4 ivs 4 lipotropic package';
update public.treatments set cost = 217.70, cost_is_estimated = true where normalized_name = 'energy precision endo flow ivs series';
update public.treatments set cost = 28.00, cost_is_estimated = true where normalized_name = 'lipotropic inyections';
update public.treatments set cost = 308.70, cost_is_estimated = true where normalized_name = 'nad iv series protocol';
update public.treatments set cost = 485.80, cost_is_estimated = true where normalized_name = 'peptide ivs packages';
update public.treatments set cost = 875.00, cost_is_estimated = true where normalized_name = 'radiesse';
update public.treatments set cost = 950.25, cost_is_estimated = true where normalized_name = 'regenerative glow protocol for annette';
update public.treatments set cost = 171.50, cost_is_estimated = true where normalized_name = 'testosterone optimization protocol';

drop view if exists public.services_performance;
drop view if exists public.product_performance;
drop view if exists public.treatment_performance;
drop view if exists public.margin_quality;

create view public.services_performance as
select s.id, s.name, s.price, s.cost, s.cost_is_estimated,
       count(i.id) as lines,
       coalesce(sum(i.quantity), 0)::numeric(12,2) as units,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as revenue,
       coalesce(sum(i.quantity * s.cost), 0)::numeric(12,2) as total_cost,
       (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * s.cost), 0))::numeric(12,2) as margin
from public.services s left join public.sale_items i on i.service_id = s.id
group by s.id, s.name, s.price, s.cost, s.cost_is_estimated;

create view public.product_performance as
select p.id, p.name, p.price, p.cost, p.cost_is_estimated,
       count(i.id) as lines,
       coalesce(sum(i.quantity), 0)::numeric(12,2) as units,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as revenue,
       coalesce(sum(i.quantity * p.cost), 0)::numeric(12,2) as total_cost,
       (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * p.cost), 0))::numeric(12,2) as margin
from public.products p left join public.sale_items i on i.product_id = p.id
group by p.id, p.name, p.price, p.cost, p.cost_is_estimated;

create view public.treatment_performance as
select t.id, t.name, t.price, t.cost, t.cost_is_estimated,
       count(i.id) as lines,
       coalesce(sum(i.quantity), 0)::numeric(12,2) as units,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as revenue,
       coalesce(sum(i.quantity * t.cost), 0)::numeric(12,2) as total_cost,
       (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * t.cost), 0))::numeric(12,2) as margin
from public.treatments t left join public.sale_items i on i.treatment_id = t.id
group by t.id, t.name, t.price, t.cost, t.cost_is_estimated;

create view public.margin_quality as
select 'products' as catalog, count(*) filter (where cost_is_estimated) as estimated, count(*) as total from public.products
union all select 'services', count(*) filter (where cost_is_estimated), count(*) from public.services
union all select 'treatments', count(*) filter (where cost_is_estimated), count(*) from public.treatments;
