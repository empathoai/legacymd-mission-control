# Database and import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the full schema in Supabase and load the workbook's 505 rows into it, with row counts and revenue that reconcile against the Excel.

**Architecture:** Eleven SQL migrations create catalogs, operation tables and read views. A Python generator reads `docs/Ingresos Follow-Up.xlsx` and emits deterministic SQL, which is applied in three passes: customers, sales with items, payments.

**Tech Stack:** PostgreSQL 15 (Supabase), SQL migrations, Python 3 with openpyxl, `psql` or the Supabase Management API.

**Spec:** `docs/superpowers/specs/2026-11-19-mission-control-mvp-design.md`

## Global Constraints

- All identifiers and comments in English; conversation with the owner in Spanish.
- Money is `numeric(10,2)` (line totals `numeric(12,2)`). Never float.
- Every import is idempotent: re-running it must not duplicate rows.
- Revenue is quantity x unit price. The workbook's Total column is not trusted.
- Two rows feed every decision: `docs/data/customers.csv` (201 customers) and the workbook.

## Review Focus

- A sale with **no items** would still count as a visit in `sales_with_totals`; the import must never produce one.
- A customer whose only sale is deleted would show `is_settled = true` with `paid_total = 0`; balance views must not read that as "paid".
- Dates in the workbook with a wrong year (2022, 2025) must not land in a past month bucket.
- Rows with a comma-separated product cell must split into separate items, not one item with a text price.
- A repeat visit must not carry a `source_id`; only the first visit does.

---

### Task 1: Apply the migrations

**Files:**
- Use: `supabase/migrations/2026111909*.sql` (11 files)

**Interfaces:**
- Produces: every table and view named in the spec, with the seeds loaded.

- [ ] **Step 1: Set the connection string**

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:<password>@db.konjxlatjymqrzebvtdu.supabase.co:5432/postgres"
```

- [ ] **Step 2: Apply every migration in filename order**

```powershell
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
  psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f $_.FullName
}
```

Expected: each file reports `CREATE TABLE`, `INSERT 0 n`, `CREATE VIEW`; no errors.

- [ ] **Step 3: Verify the seeds**

```sql
select 'categories', count(*) from categories
union all select 'sources', count(*) from sources
union all select 'payment_methods', count(*) from payment_methods
union all select 'treatments', count(*) from treatments
union all select 'products', count(*) from products
union all select 'services', count(*) from services;
```

Expected: categories 4, sources 6, payment_methods 8, treatments 33, products 31, services 2.

- [ ] **Step 4: Verify the generated columns**

```sql
select name, cost, price, margin from treatments where name = 'Weight Loss Packages w/ Tirzepatide';
```

Expected: cost 490.00, price 495.00, margin 5.00.

---

### Task 2: Import customers

**Files:**
- Create: `scripts/import/build_customers.py`
- Create: `build/customers.sql` (generated)

**Interfaces:**
- Consumes: `docs/data/customers.csv`.
- Produces: `public.customers` with 201 rows; the `normalized_name` used by every later task.

- [ ] **Step 1: Write the generator**

`build_customers.py` reads the CSV and emits `insert into customers (full_name, normalized_name, aliases) values (...)` with `on conflict (normalized_name) do nothing`, escaping single quotes by doubling them and rendering `aliases` as a Postgres array literal.

- [ ] **Step 2: Run it and apply**

```powershell
python scripts/import/build_customers.py
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f build/customers.sql
```

Expected: `INSERT 0 201`.

- [ ] **Step 3: Verify**

```sql
select count(*) from customers;
select count(*) from customers where normalized_name <> lower(normalized_name);
```

Expected: 201 and 0.

---

### Task 3: Import sales and their items

**Files:**
- Create: `scripts/import/build_sales.py`
- Create: `build/sales.sql` (generated)

**Interfaces:**
- Consumes: the workbook, `customers.normalized_name`, `treatments.normalized_name`, `products.normalized_name`, `services.normalized_name`.
- Produces: `public.sales` (486 rows) and `public.sale_items` (668 rows). Each sale's `is_first_visit` is true exactly once per customer, on their earliest sale.

- [ ] **Step 1: Write the generator**

It groups workbook rows by `(normalized_name, date)` — merging the 19 days where one patient has two rows — drops `Memorial Day`, clamps years below 2026 to 2026, and emits, per sale:

- one `sales` row with `occurred_on`, customer resolved by `normalized_name`, `source_id` only when the sale is that customer's first, and `is_first_visit`;
- one `sale_items` row per treatment, per split product, and per lab service, each with `quantity`, `unit_price`, and `category_id` resolved from the workbook's category column (mapped `Perfomance` → performance, `W/L - Mens Health` → mens_health).

Use CTEs keyed by `normalized_name` so no uuid is hardcoded: `with s as (insert into sales ... returning id, customer_id), i as (insert into sale_items select ...)`.

- [ ] **Step 2: Run it and apply**

```powershell
python scripts/import/build_sales.py
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f build/sales.sql
```

Expected: `INSERT 0 486` then `INSERT 0 668`.

- [ ] **Step 3: Verify counts and the first-visit rule**

```sql
select count(*) as sales from sales;
select count(*) as items from sale_items;
select count(*) as first_visits from sales where is_first_visit;
select count(*) from customers c where not exists (select 1 from sales s where s.customer_id = c.id);
```

Expected: 486, 668, 201, 0.

---

### Task 4: Import the payment schedule

**Files:**
- Create: `scripts/import/build_payments.py`
- Create: `build/payments.sql` (generated)

**Interfaces:**
- Consumes: `sales`, `payment_methods.slug`.
- Produces: `public.sale_payments`, one `paid` row per sale.

- [ ] **Step 1: Write the generator**

Maps the workbook's method column to slugs (`Caren Credit` → `care_credit`, blank → `unspecified`), and emits one `sale_payments` row per sale with `due_on = sales.occurred_on`, `amount` = that sale's item total, `status = 'paid'`, `paid_on = due_on`. No installment rows: the workbook does not record terms.

- [ ] **Step 2: Run it and apply**

```powershell
python scripts/import/build_payments.py
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f build/payments.sql
```

Expected: `INSERT 0 486`.

- [ ] **Step 3: Verify money**

```sql
select sum(total) from sales_with_totals;
select sum(amount) from sale_payments;
select count(*) from sales s where not exists (select 1 from sale_payments p where p.sale_id = s.id);
```

Expected: 219132.91 in both sums, and 0 sales without a payment.

---

### Task 5: Reconcile against the workbook

**Files:**
- Create: `docs/data/import-reconciliation.md`

**Interfaces:**
- Consumes: everything imported.
- Produces: a written record of the deltas, so a future reader does not re-open settled questions.

- [ ] **Step 1: Run the reconciliation queries**

```sql
select to_char(occurred_on, 'YYYY-MM') as month,
       count(*) filter (where is_first_visit) as new_patients,
       count(*) as sales
from sales group by 1 order by 1;

select sum(line_total) as revenue,
       count(distinct sale_id) as sales,
       count(*) as items
from sale_items;

select * from revenue_by_category order by month, category_slug;
```

Expected new patients per month: 2026-05 59, 06 26, 07 23, 08 29, 09 21, 10 32, 11 11. Expected revenue 219,132.91.

- [ ] **Step 2: Write the reconciliation file**

Record: 505 rows → 486 sales → 668 items; revenue 219,132.91 versus the workbook Total column 217,620.60 (delta 1,512.31, explained by stale formulas); two rows had years clamped; one duplicate-name merge (Sandea/Sandra Desme) and one split (Claudia/Claudio Rodriguez); 89 rows imported as `unspecified` payment method.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations scripts/import build docs/data docs/superpowers
git commit -m "feat(db): schema, seeds and workbook import"
```
