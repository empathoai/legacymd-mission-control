-- 20261119091300_import_review.sql
-- Lines that cannot be imported without guessing go here instead of into the
-- operational tables. Nothing is lost: the raw row, the reason and the amount
-- are kept until the owner confirms what to do with them.

create table if not exists public.import_review (
  id            uuid primary key default gen_random_uuid(),
  source_sheet  text not null,
  source_row    integer not null,
  occurred_on   date,
  customer_name text,
  amount        numeric(12,2),
  reason        text not null,
  payload       jsonb not null,
  status        text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (source_sheet, source_row, reason)
);

comment on table public.import_review is 'Workbook lines held back from the import until a human decides what they are.';
comment on column public.import_review.amount is 'Amount at stake in the source row, so the held-back total is auditable.';
comment on column public.import_review.payload is 'Raw values of the source row: service, product, quantities, unit prices, total, comment.';

create index if not exists import_review_status_idx on public.import_review (status);

-- Idempotency: a sale is unique per customer and day, a payment per sale+method+due date.
-- Without these, re-running the import duplicates revenue.
create unique index if not exists sales_customer_day_uidx
  on public.sales (customer_id, occurred_on);

create unique index if not exists sale_payments_sale_method_due_uidx
  on public.sale_payments (sale_id, method_id, due_on);
