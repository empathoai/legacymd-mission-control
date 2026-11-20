-- 20261119091600_revenue_segregation.sql
-- Revenue is not one number: treatments, products and services have different
-- margins and different behaviour, and the category is the accounting cut.
-- Same cost rule as before: a line without a catalog cost is reported through
-- revenue_with_cost instead of being treated as free.

create or replace view public.profitability_by_kind as
select
  date_trunc('month', sa.occurred_on)::date                       as month,
  case
    when i.treatment_id is not null then 'treatment'
    when i.product_id is not null then 'product'
    when i.service_id is not null then 'service'
    else 'unmapped'
  end                                                             as kind,
  count(*)                                                        as lines,
  sum(i.quantity)::numeric(12,2)                                  as units,
  sum(i.line_total)::numeric(12,2)                                as revenue,
  sum(i.quantity * coalesce(t.cost, p.cost, s.cost))::numeric(12,2) as cost,
  (sum(i.line_total) - sum(i.quantity * coalesce(t.cost, p.cost, s.cost)))::numeric(12,2) as margin,
  sum(case when coalesce(t.cost, p.cost, s.cost) is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services s on s.id = i.service_id
group by 1, 2;

comment on view public.profitability_by_kind is 'Monthly revenue, cost and margin split into treatments, products and services.';

create or replace view public.profitability_by_category as
select
  date_trunc('month', sa.occurred_on)::date                       as month,
  coalesce(c.slug, 'uncategorised')                               as category,
  coalesce(c.label, 'Uncategorised')                              as category_label,
  count(*)                                                        as lines,
  sum(i.line_total)::numeric(12,2)                                as revenue,
  sum(i.quantity * coalesce(t.cost, p.cost, s.cost))::numeric(12,2) as cost,
  (sum(i.line_total) - sum(i.quantity * coalesce(t.cost, p.cost, s.cost)))::numeric(12,2) as margin,
  round(100.0 * (sum(i.line_total) - sum(i.quantity * coalesce(t.cost, p.cost, s.cost))) / nullif(sum(i.line_total), 0), 1) as margin_pct,
  sum(case when coalesce(t.cost, p.cost, s.cost) is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
left join public.categories c on c.id = i.category_id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services s on s.id = i.service_id
group by 1, 2, 3;

comment on view public.profitability_by_category is 'Monthly revenue, cost and margin per sale category.';

create or replace view public.product_performance as
select
  p.id,
  p.name,
  p.price,
  p.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.quantity * p.cost), 0)::numeric(12,2)            as total_cost,
  (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * p.cost), 0))::numeric(12,2) as margin
from public.products p
left join public.sale_items i on i.product_id = p.id
group by p.id, p.name, p.price, p.cost;

comment on view public.product_performance is 'Products sold: units, revenue and margin, including products never sold (lines = 0).';

create or replace view public.treatment_performance as
select
  t.id,
  t.name,
  t.price,
  t.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.quantity * t.cost), 0)::numeric(12,2)            as total_cost,
  (coalesce(sum(i.line_total), 0) - coalesce(sum(i.quantity * t.cost), 0))::numeric(12,2) as margin
from public.treatments t
left join public.sale_items i on i.treatment_id = t.id
group by t.id, t.name, t.price, t.cost;

comment on view public.treatment_performance is 'Treatments sold: units, revenue and margin, including treatments never sold.';


