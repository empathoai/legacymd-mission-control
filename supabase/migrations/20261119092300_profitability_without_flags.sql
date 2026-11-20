-- 20261119092300_profitability_without_flags.sql
-- Margin is revenue minus cost. Nothing else: no estimated/provisional branch,
-- no special case. The placeholder cost is just a number in the catalog, and
-- when the owner replaces it the same formula returns the real figure.

drop view if exists public.services_performance;
drop view if exists public.product_performance;
drop view if exists public.treatment_performance;
drop view if exists public.margin_quality;

create view public.services_performance as
select s.id, s.name, s.price, s.cost,
       count(i.id) as lines,
       coalesce(sum(i.quantity), 0)::numeric(12,2) as units,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as revenue,
       coalesce(sum(i.quantity * s.cost), 0)::numeric(12,2) as total_cost,
       (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * s.cost), 0))::numeric(12,2) as margin
from public.services s left join public.sale_items i on i.service_id = s.id
group by s.id, s.name, s.price, s.cost;

create view public.product_performance as
select p.id, p.name, p.price, p.cost,
       count(i.id) as lines,
       coalesce(sum(i.quantity), 0)::numeric(12,2) as units,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as revenue,
       coalesce(sum(i.quantity * p.cost), 0)::numeric(12,2) as total_cost,
       (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * p.cost), 0))::numeric(12,2) as margin
from public.products p left join public.sale_items i on i.product_id = p.id
group by p.id, p.name, p.price, p.cost;

create view public.treatment_performance as
select t.id, t.name, t.price, t.cost,
       count(i.id) as lines,
       coalesce(sum(i.quantity), 0)::numeric(12,2) as units,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as revenue,
       coalesce(sum(i.quantity * t.cost), 0)::numeric(12,2) as total_cost,
       (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * t.cost), 0))::numeric(12,2) as margin
from public.treatments t left join public.sale_items i on i.treatment_id = t.id
group by t.id, t.name, t.price, t.cost;
