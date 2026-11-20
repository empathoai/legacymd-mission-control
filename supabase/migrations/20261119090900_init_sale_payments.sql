-- 20261119090900_init_sale_payments.sql
-- Payments belong to the sale, not to a single column on it: the workbook has
-- 42 rows whose real payment is split ("$300 credit + $210 cash", "faltan $82"),
-- and financing spreads the money over months.
-- One row per scheduled payment. A cash sale is one row, already paid.

alter table public.payment_methods
  add column if not exists supports_installments boolean not null default false,
  add column if not exists settles_immediately  boolean not null default true;

comment on column public.payment_methods.supports_installments is 'True when the UI should ask how many months the patient chose (Stripe, Cherry, Care Credit).';
comment on column public.payment_methods.settles_immediately is 'True when the clinic receives the whole amount on sale day (cash, card, Zelle, Cherry, Care Credit). False for Stripe, which pays month by month.';

update public.payment_methods set supports_installments = true where slug in ('stripe', 'cherry', 'care_credit');
update public.payment_methods set settles_immediately = false where slug = 'stripe';

create table if not exists public.sale_payments (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  method_id    uuid not null references public.payment_methods(id) on delete restrict,
  due_on       date not null,
  amount       numeric(12,2) not null check (amount > 0),
  status       text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  paid_on      date,
  installments smallint check (installments is null or installments between 2 and 120),
  created_at   timestamptz not null default now(),
  constraint payment_paid_has_date check ((status = 'paid') = (paid_on is not null))
);

comment on table public.sale_payments is 'Cash schedule for a sale: one row per installment or split payment.';
comment on column public.sale_payments.due_on is 'Date the money is expected. Past + pending means overdue.';
comment on column public.sale_payments.amount is 'Amount of this installment, not the sale total.';
comment on column public.sale_payments.installments is 'Financing term the patient agreed to (Cherry, Care Credit). Informational: the clinic was already paid in full, so the row is paid on the sale date.';

create index if not exists sale_payments_sale_idx on public.sale_payments (sale_id);
create index if not exists sale_payments_due_idx on public.sale_payments (due_on);
create index if not exists sale_payments_pending_idx on public.sale_payments (due_on) where status = 'pending';

create or replace view public.cash_forecast as
select
  date_trunc('month', due_on)::date as month,
  sum(amount) filter (where status = 'pending')::numeric(12,2) as expected,
  sum(amount) filter (where status = 'paid')::numeric(12,2) as received
from public.sale_payments
group by 1
order by 1;

comment on view public.cash_forecast is 'Expected vs received cash per month, from the payment schedule.';

-- Payment method moves to the payment row; a sale can mix methods.
alter table public.sales drop column if exists payment_method_id;
