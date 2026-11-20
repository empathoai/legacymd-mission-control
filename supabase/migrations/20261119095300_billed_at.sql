-- 095300_billed_at.sql
-- Two kinds of time per transaction, with different jobs:
--   occurred_on date        the business day. Reports group by it.
--   billed_at   timestamptz  the moment the sale was billed and priced. Orders same-day
--                            sales and resolves the cost interval.
--   created_at  timestamptz  technical: when the row was written. For imported rows this
--                            is the import afternoon, not the business moment.
--
-- The 432 imported sales have no real billing time, so billed_at points at their visit day
-- at noon and billed_at_source says 'reconstructed'. A live sale says 'live'.

alter table public.sales rename column priced_at to billed_at;
alter index if exists public.sales_priced_at_idx rename to sales_billed_at_idx;

alter table public.sales
  add column if not exists billed_at_source text not null default 'live';

alter table public.sales
  drop constraint if exists billed_at_source_valid;
alter table public.sales
  add constraint billed_at_source_valid check (billed_at_source in ('live', 'reconstructed'));

update public.sales
set billed_at_source = 'reconstructed'
where billed_at_source = 'live'
  and billed_at::date <> current_date;

comment on column public.sales.billed_at is
  'Moment the sale was billed and its cost fixed. Live sales use now(); imported sales point at their visit day at noon.';
comment on column public.sales.billed_at_source is
  'live = recorded by the app; reconstructed = imported, the time is the visit day at noon.';
comment on column public.sales.occurred_on is
  'Business day of the visit. Reports group by this date.';
comment on column public.sales.created_at is
  'Technical insert time. For imported rows it is the import moment, not the business moment.';
