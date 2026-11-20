-- 100100_assign_instagram_source.sql
-- The workbook answered 'bot' for this sale, which was not a real acquisition channel and
-- has been removed. The owner decided the channel is Instagram. The sale is a first visit,
-- so carrying a source on it is consistent with the rule.

update public.sales s
set source_id = (select id from public.sources where slug = 'instagram')
where s.id = (
  select sa.id
  from public.sales sa
  join public.customers c on c.id = sa.customer_id
  where c.full_name = 'Ezequiel Cabrera'
    and sa.occurred_on = date '2026-05-14'
);
