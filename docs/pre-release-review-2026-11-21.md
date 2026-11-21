# Pre-release review — 2026-11-21

Five agents audited the app in parallel: architecture, data layer, end-to-end flows, build and
UI. This is the consolidated record: what was checked, what was corrected, the evidence, and
what remains. Nothing was published.

## How it was run

| Agent | Scope | Full report |
|---|---|---|
| Architecture | routes, components, actions, dead code, configs | this document, section 1 |
| Data | functions, views, grants, checks, integrity | section 2 |
| Flows | 13 routes + catalog tabs at 1440 and 390, 276 screenshots | [`qa-end-to-end-flows-2026-11-21.md`](qa-end-to-end-flows-2026-11-21.md) |
| Build | install, typecheck, build, audit, env, deps | section 3 |
| UI | layout, labels, empty states, dialogs, mobile | `shots/ui-review-2026-11-21.md` (kept out of git: it quotes patient names) |

## 1. Corrections applied, step by step

All six are data-side. The UI belongs to the owner and was not touched.

| # | What changed | Where | Why | Evidence |
|---|---|---|---|---|
| C1 | **Sale lines can no longer be updated or deleted**, and a **sale can no longer be deleted**. Triggers raise `23514` with a message that names the sanctioned paths. | migration `20261121270000` | The immutability rule was a convention: a rollback test updated a line's price, deleted a line, moved `billed_at` 400 days and rewrote `visit_number`. | probe: `update sale_items` → *"a sale line is immutable: correct the sale with a return or a void"*; `delete from sales` → *"a sale is never deleted"* |
| C2 | **A voided sale is no longer revenue** in `sales_with_totals`, `discount_by_month` and `revenue_by_category`, and so not in `monthly_balance` either. | same migration | A rollback test voided a 500,00 sale: `monthly_pl` excluded it, `monthly_balance` counted it. | after the change, `sales_with_totals` total still equals `sum(line_total)` = 219.460,91 |
| C3 | **`payment_receipts.external_id` is unique** when present (partial unique index). | same migration | A retried webhook or a second reconciliation could record the same charge twice; `record_receipt` does not check idempotency. | probe: two receipts with `external_id='probe-dup'` → `23505 duplicate key` |
| C4 | **A void reason needs four characters** in `sales` and `sale_payments`. | same migration | The CHECK only asked for non-null, so `''` passed while the screen asked for four. | constraint declared and asserted; not exercised, because every installment has receipts and the void guards fire first |
| C5 | **C19 compares numbers, not words.** The old check searched the view text for `voided_at is null`; `monthly_balance` contained that text in its expense CTE while its revenue was unfiltered. Its control now recreates the regression (unfiltered view + a voided sale) and the check must fire. | `supabase/checks/c19_views_skip_voided.sql` + control | The check was a false green on the one thing it existed to protect. | `check c19: 0 rows`, `control c19: fired (1 row)` |
| C6 | **`reconcile_catalog.py` works again**: its SQL read `duration_months`, dropped by `20261121210000`. | `scripts/reconcile_catalog.py` | The script was broken exactly when it is needed for the open catalog decision. | re-ran it against the owner's sheet: it completes and reports the Timmix price difference (unit 250 vs sheet 1.000) |

Each migration was applied with `scripts/apply_migrations.py`, which re-applies the access
lock-down as an invariant and stops on the first failure.

## 2. What the data audit found and did not change

Verified in rollback, still open, in priority order:

1. **`void_payment` writes no write-off.** Cancelling an installment leaves `sold 100, planned 50,
   written_off 0`, so C01 reports the sale and the balance keeps charging a forgiven cuota. D5
   says the default is to forgive; the function does not create the adjustment.
2. **No date guards**: `create_sale`, `record_receipt`, `register_return` and `settle_return`
   accept 2099 and land in a future month; `settle_return` records no actor.
3. **`set_item_price` with a past date** updates the catalog column even when a newer interval
   exists (the state C20 catches after the fact); **`cost_on(date)`** resolves midnight in UTC,
   so 56 of 59 cost intervals answer the previous cost or null.
4. **`create_sale` accepts an active item with no price** (`TRT-0027`) and a free-text line after
   the cutover; C05 reports them afterwards. The sale screen filters them; the function does not.
5. **C16 has no control**, and the C11 control cannot fire its RLS branch because the
   `ensure_rls` event trigger enables RLS at `CREATE TABLE`.

## 3. Build and dependencies — verified results

| Command | Exit | Result |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | already up to date, no drift |
| `pnpm typecheck` | 0 | clean |
| `pnpm build` | 0 | 26 routes, compiled |
| `pnpm audit` | 1 | 1 moderate (`minimatch` through `shadcn`, a CLI kept in `dependencies`) |
| `pnpm lint` | 1 | 5 errors (`react-hooks/set-state-in-effect`), 2 unused variables |
| `py scripts/run_checks.py` | 0 | 20 checks, 19 controls, baseline 435 |

## 4. What was verified in the browser

Every sidebar route at 1440 and 390, the five catalog tabs, the sale screen with its draft, sales
details totals, patients, Returns/Voids/Open items/Expenses. The totals match the base to the
cent (May 36.732,50; history 219.460,91; November 18.599,92). Details in
[`qa-end-to-end-flows-2026-11-21.md`](qa-end-to-end-flows-2026-11-21.md).

## 5. Not verified

- No real write was submitted: no sale, return, void, receipt, expense or patient was created.
- The login gate was not exercised in production mode.
- The historical import was not reproduced (its generators were deleted with the previous base).
- No build from a clean `.next`.

## 6. Blockers before publishing

1. ~~The publishable key is missing, so the auth client and the middleware run with the secret key.~~ **Closed 2026-11-21**: the key is in `web/.env.local`; a production server answers 307 on a protected route and 200 on `/login`.
2. The mobile drawer does not close on navigation; its Close button is 0×0 and Escape does nothing.
3. `/expenses/<period>` is 680 px wide at 390; the filter strip does not wrap.
4. Returns and Voids lose their action column at 390 (`table-fixed` gives it 0 px).
5. The five data items in section 2, starting with `void_payment`.
