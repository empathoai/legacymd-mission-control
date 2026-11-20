-- 100000_remove_bot_source.sql
-- 'bot' was seeded as an acquisition channel in the first import, but the scheduler is not a
-- marketing channel: the clinic does not acquire patients through it. It is removed.
-- One sale answered 'bot' in the workbook (Ezequiel Cabrera, 2026-05-14). It is left with
-- no source instead of guessing one; the owner can assign the real channel later.

update public.sales s
set source_id = null
from public.sources src
where src.id = s.source_id and src.slug = 'bot';

delete from public.sources where slug = 'bot';

comment on table public.sources is
  'Acquisition channel for a sale: referral, instagram, facebook, groupon, website.';
