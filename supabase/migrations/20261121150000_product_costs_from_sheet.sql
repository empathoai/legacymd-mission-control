-- 20261121150000_product_costs_from_sheet.sql
-- The real average cost of 20 products, from the owner's catalog sheet (2026-11-21).
--
-- How the history got here: the costs entered on 2026-01-01 were already the sheet's
-- numbers. The cutover replaced them on 2026-05-01 with an estimate ("catalog cost, no
-- real effective date"), and 2026-11-01 replaced that with a $1.00 placeholder. Every
-- sale in the base is from May onwards, so the margins read the estimate, and the
-- calendar month of November read the placeholder.
--
-- This replaces both intervals with the owner's number from 2026-05-01, one interval
-- open to infinity, so every past line and every future sale reads the same real cost.
-- The sale rows do not move: margin is derived from the interval that covers the day.

do $$
declare
  v_wrong int;
  v_gaps int;
begin
  create temporary table sheet_costs (code text primary key, cost numeric not null) on commit drop;
  insert into sheet_costs (code, cost) values
    ('PROD-0001', 43.00),   -- Arum Fresh
    ('PROD-0003', 29.00),   -- Arum Microbiota
    ('PROD-0007', 37.50),   -- Enclomiphen
    ('PROD-0008', 85.00),   -- Exosomes
    ('PROD-0009', 35.00),   -- Factor G Serum - Skin Care
    ('PROD-0011', 4.00),    -- Gluthation Shot
    ('PROD-0012', 25.00),   -- Insomnitol
    ('PROD-0013', 120.00),  -- Ipamorelin CJC Injectable
    ('PROD-0014', 150.00),  -- Ipamorelin CJC Troches
    ('PROD-0015', 7.00),    -- IV Add-On Circulate
    ('PROD-0016', 52.00),   -- IV Endo Flow
    ('PROD-0017', 35.00),   -- LibidoStim F
    ('PROD-0018', 130.00),  -- Lip Filler (the product row; the treatment keeps 130 too)
    ('PROD-0019', 4.00),    -- Lipotropic IM
    ('PROD-0020', 74.00),   -- NAD+ therapy
    ('PROD-0022', 43.00),   -- NoxSynergy
    ('PROD-0027', 559.00),  -- Sculptra
    ('PROD-0029', 56.00),   -- Testosterone Cream
    ('PROD-0030', 48.00),   -- Testosterone Injecyable
    ('PROD-0031', 4.00);    -- Vitamine Shots

  -- The estimate and the placeholder both start on or after 2026-05-01. Dropping them
  -- first makes the insert below the only open interval, so no old number survives.
  delete from public.item_cost_history h
  using public.products p, sheet_costs s
  where h.item_kind = 'product'
    and h.item_id = p.id
    and p.code = s.code
    and h.effective_from >= timestamptz '2026-05-01 00:00:00+00';

  perform public.set_item_cost('product', p.id, s.cost, timestamptz '2026-05-01 00:00:00+00')
  from public.products p
  join sheet_costs s on s.code = p.code;

  -- Every one of the 20 must answer with the sheet cost on the first day the base
  -- covers, in the middle of the history, and today; and keep exactly one interval
  -- from 2026-05-01 onwards.
  select count(*) into v_wrong
  from sheet_costs s
  join public.products p on p.code = s.code
  where public.cost_on('product', p.id, date '2026-05-01') is distinct from s.cost
     or public.cost_on('product', p.id, date '2026-08-15') is distinct from s.cost
     or public.cost_on('product', p.id, date '2026-11-21') is distinct from s.cost;
  if v_wrong > 0 then
    raise exception 'C: % products do not read the sheet cost', v_wrong;
  end if;

  select count(*) into v_gaps
  from sheet_costs s
  join public.products p on p.code = s.code
  join public.item_cost_history h
    on h.item_kind = 'product' and h.item_id = p.id
   and h.effective_from >= timestamptz '2026-05-01 00:00:00+00';
  if v_gaps <> 20 then
    raise exception 'C: expected one open interval per product, found %', v_gaps;
  end if;

  raise notice '20 product costs replaced from the sheet';
end $$;
