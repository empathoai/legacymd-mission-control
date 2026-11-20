-- 20261119092900_schema_migrations_ledger.sql
-- scripts/apply_migrations.py used to re-run every file on every invocation. Two
-- of them are not re-runnable: 091000 replaces a view whose shape changed later,
-- and 091400 drops the expense tables, which would wipe the 99 loaded entries.
-- A full run therefore reported two errors and silently relied on the Management
-- API wrapping each file in a transaction to roll the damage back.
--
-- From here on the runner records what it applied, skips it, and stops on the
-- first error. This file seeds the ledger with everything applied before it.

create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);

comment on table public.schema_migrations is
  'Migration ledger for scripts/apply_migrations.py: a file is applied at most once.';

insert into public.schema_migrations (filename) values
  ('20261119090000_init_categories.sql'),
  ('20261119090100_init_customers.sql'),
  ('20261119090200_init_sources.sql'),
  ('20261119090300_init_treatments.sql'),
  ('20261119090400_seed_treatments.sql'),
  ('20261119090450_init_products.sql'),
  ('20261119090500_seed_products.sql'),
  ('20261119090600_init_payment_methods.sql'),
  ('20261119090650_init_services.sql'),
  ('20261119090700_init_sales.sql'),
  ('20261119090900_init_sale_payments.sql'),
  ('20261119091000_customer_balances.sql'),
  ('20261119091100_add_missing_treatments.sql'),
  ('20261119091200_relax_payment_amount.sql'),
  ('20261119091300_import_review.sql'),
  ('20261119091400_init_expenses.sql'),
  ('20261119091500_analytics.sql'),
  ('20261119091600_revenue_segregation.sql'),
  ('20261119091700_estimated_costs.sql'),
  ('20261119091800_customer_merge_candidates.sql'),
  ('20261119091900_sale_item_discount.sql'),
  ('20261119092000_cost_snapshot.sql'),
  ('20261119092100_cost_confirmation.sql'),
  ('20261119092200_set_product_cost.sql'),
  ('20261119092300_profitability_without_flags.sql'),
  ('20261119092400_treatment_unit_type.sql'),
  ('20261119092500_package_quantity_rule.sql'),
  ('20261119092600_treatment_description.sql'),
  ('20261119092700_fix_customer_balances.sql'),
  ('20261119092800_lock_down_public_access.sql')
on conflict (filename) do nothing;
