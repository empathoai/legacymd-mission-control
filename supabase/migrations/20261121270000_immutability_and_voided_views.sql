-- 20261121270000_immutability_and_voided_views.sql
-- Four holes the pre-release review found in the data layer. None of them shows today —
-- the base has 0 voided sales, 0 returns, 0 adjustments — and all of them fire the first
-- time the desk voids something.
--
-- 1. A sale line could be edited or deleted, and a sale deleted outright. The rule "the
--    transactional base is immutable" was a convention, not a guard. Now it is a trigger.
-- 2. A voided sale still counted as revenue in `sales_with_totals` (and therefore in
--    `monthly_balance`), in `discount_by_month` and in `revenue_by_category`. A sale with no
--    money never happened, so the three views skip it.
-- 3. `payment_receipts.external_id` had no uniqueness, so a retried webhook or a second
--    reconciliation could record the same charge twice. Now it is unique when present.
-- 4. A void reason of "" passed the CHECK, which only asked for a non-null value. Four
--    characters, the same the screen asks for.

do $$
begin
  -- 1. The sale line does not change and does not disappear.
  create or replace function public.guard_sale_item_immutable()
  returns trigger
  language plpgsql
  as $fn$
  begin
    raise exception 'a sale line is immutable: correct the sale with a return or a void'
      using errcode = '23514';
  end;
  $fn$;

  drop trigger if exists sale_items_immutable on public.sale_items;
  create trigger sale_items_immutable
    before update or delete on public.sale_items
    for each row execute function public.guard_sale_item_immutable();

  -- A sale is never deleted. A void marks it; the row stays.
  create or replace function public.guard_sale_delete()
  returns trigger
  language plpgsql
  as $fn$
  begin
    raise exception 'a sale is never deleted: void it, or correct it with a return'
      using errcode = '23514';
  end;
  $fn$;

  drop trigger if exists sales_no_delete on public.sales;
  create trigger sales_no_delete
    before delete on public.sales
    for each row execute function public.guard_sale_delete();

  -- 4. A reason is a reason.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sales'::regclass and conname = 'sales_void_reason_length'
  ) then
    alter table public.sales
      add constraint sales_void_reason_length
      check (void_reason is null or length(btrim(void_reason)) >= 4);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sale_payments'::regclass and conname = 'sale_payments_void_reason_length'
  ) then
    alter table public.sale_payments
      add constraint sale_payments_void_reason_length
      check (void_reason is null or length(btrim(void_reason)) >= 4);
  end if;

  -- 3. One charge, one receipt.
  create unique index if not exists payment_receipts_external_id_key
    on public.payment_receipts (external_id)
    where external_id is not null;
end $$;

-- 2. A voided sale is not revenue anywhere.
create or replace view public.sales_with_totals
with (security_invoker = true) as
select s.id,
       s.occurred_on,
       s.customer_id,
       s.source_id,
       s.is_first_visit,
       s.notes,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as total
from public.sales s
left join public.sale_items i on i.sale_id = s.id
where s.voided_at is null
group by s.id;

create or replace view public.discount_by_month
with (security_invoker = true) as
select date_trunc('month', s.occurred_on::timestamptz)::date as month,
       count(*) filter (where i.discount > 0) as discounted_lines,
       sum(i.line_total)::numeric(12,2) as charged,
       sum(i.list_price * i.quantity)::numeric(12,2) as list_value,
       sum(i.discount)::numeric(12,2) as discount
from public.sale_items i
join public.sales s on s.id = i.sale_id
where s.voided_at is null
group by 1
order by 1;

create or replace view public.revenue_by_category
with (security_invoker = true) as
select date_trunc('month', s.occurred_on::timestamptz)::date as month,
       c.slug as category_slug,
       count(*) as lines,
       sum(i.line_total)::numeric(12,2) as revenue
from public.sale_items i
join public.sales s on s.id = i.sale_id
left join public.categories c on c.id = i.category_id
where s.voided_at is null
group by 1, c.slug;

do $$
declare
  v_missing int;
  v_revenue numeric;
  v_lines numeric;
begin
  select count(*) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname in ('sales_with_totals', 'discount_by_month', 'revenue_by_category', 'monthly_balance')
    and not exists (
      select 1 from unnest(coalesce(c.reloptions, array[]::text[])) as opt
      where opt = 'security_invoker=true'
    );
  if v_missing > 0 then
    raise exception 'C: % recreated views lost security_invoker', v_missing;
  end if;

  select coalesce(sum(total), 0) into v_revenue from public.sales_with_totals;
  select coalesce(sum(line_total), 0) into v_lines from public.sale_items;
  if v_revenue <> v_lines then
    raise exception 'C: sales_with_totals (%) differs from the lines (%)', v_revenue, v_lines;
  end if;

  raise notice 'guards in place; voided sales excluded; external_id unique';
end $$;
