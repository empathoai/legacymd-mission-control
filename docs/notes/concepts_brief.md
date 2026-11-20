# Backend E2E assurance for a schema-only backend

* **Author:** empathoai
* **Date:** 2026-11-19
* **Status:** six Goldfish lenses reviewed this concept and the synthesis below replaces the
  author-only draft. Method note: `egm_reviewer` is unavailable in this build
  (`ctx.subagents.list is not a function`), so the lenses ran as fresh general-purpose
  subagents reading their persona files, which is upstream's documented fallback. They
  were read-only by instruction, not by the harness preset.

## Overview

The backend has no API. The schema, its constraints, its two triggers and its fifteen
views are the system. The question was whether every system option must be documented
to assure E2E.

The answer the lenses converged on: **no**. Documenting every option is the wrong
instrument, and the eight-operation catalog the author proposed would have been mostly
fiction. What assures this backend is a small set of **executable assertions plus a
frozen baseline**, wired into the migration gate that already exists. A catalog entry per
operation comes later, and only for operations that are callable and tested.

## Analysis

### Where the lenses agree

1. **The unit is the operation, not the screen and not the branch.** Unanimous. But the
   artifact must be executable; prose entries are the thing that drifts.
2. **The eight-operation catalog was mostly fiction.** Six of the eight have no DDL:
   `sale_refunds`, `payment_receipts` and `adjustments` do not exist. `collect
   installment` exists only in the shape migration 32 deletes. `close month` contradicts
   decision D4 (sales months are not closed in the MVP). Writing effect lists for
   relations that do not exist documents a guess, which is the exact fault the brief
   accused API contracts of.
3. **The repo already has the right pattern.** `scripts/apply_migrations.py` re-applies
   the lock-down file after every batch and exits non-zero when a violation query returns
   rows. That is an executable invariant with a named owner and a failure mode. The
   instrument is this pattern generalized from one invariant to ten, not a new document
   genre.
4. **The oracle must be independent.** A test whose expected value comes from the current
   database pins today's behaviour, including today's bugs. The independent oracles here
   are the workbook and the decisions, not `select sum()` against the schema under test.
5. **"Catalog and tests from one definition" is a tautology for correctness.** It proves
   nothing changed. It cannot prove the number is right. Only an external oracle and a
   negative control (break the effect on purpose; the test must fail) do that.
6. **The name matters.** This is a schema-contract suite. It does not exercise the app,
   grants, RLS or the client path, because none exist. Calling it E2E overstates it to
   the owner.

### Where the lenses clash

The fault line is how much artifact to keep:

* **Zoom-out** wants no catalog at all: assertions and the gate, nothing else.
* **Structural** wants a thin machine-readable manifest whose only job is joining
  acceptance criteria, assertions and relations, with near-zero prose.
* **Design** wants entries, but only per callable, with an `enforced_by` column and an
  observed-effect diff instead of 152 hand-written table cells.

The synthesis takes the assertions as the product, the manifest as a later join key, and
entries only when a callable exists. That resolves the clash: zoom-out wins the order,
structural wins the shape of what remains, design wins the condition for adding entries.

### Blind spots the lenses caught, verified

* **The balance identity in the draft was wrong.** It read
  `sold − written_off − collected = balance`. It omitted money owed back to a patient.
  The PRD says `balance = sold − written off − collected`, and decision D2 says an unpaid
  return makes the balance negative. Three formulations exist in three documents and
  `customer_balances` computes none of them: it is still `sold − paid`, with no
  write-off and no return term.
* **Frozen costs are bypassed by every report.** `item_profitability` and `monthly_pl`
  compute cost from the live catalog (`t.cost, p.cost, s.cost`), not from the frozen
  `line_cost`/`unit_cost` columns. The decision "catalog changes never rewrite history"
  is true of the columns and false of the reports the owner reads. The next planned
  action, replacing the $1.00 product placeholder, will silently rewrite historical
  product margins.
* **A committed document already disagrees with the database.**
  `docs/data/import-reconciliation.md` states 483 sales, 655 items and 218,886.91; the
  live project has 470, 626 and 219,492.91. It was committed and nobody noticed. Every
  drift event in this project has been semantic, not structural.
* **The 470-to-470 conversion is not 470 receipts.** 38 payments have `amount = 0`
  (courtesies). A receipts table with `amount > 0` either fails on them or drops them,
  and dropping them moves the balance off the 0.00 that the baseline exists to protect.
* **`close month` has no decision and a twin.** Only expense periods close today, with
  `guard_closed_expense_period`. A second close concept would be confused with the first
  within a month.
* **"Return after void" is unreachable.** A sale with receipts can never be voided, and
  only sales with receipts can be returned. The reachable, dangerous pair is
  void → unexpected receipt → return.
* **The 12,208.59 discount is not marked.** The decision says it is flagged
  `backfilled`; no such column exists, and `discount_by_month` reports the artifact as a
  real discount.
* **"Sale lines freeze" is not enforced.** There are two triggers in the schema and
  neither guards lines. `unit_cost` is nullable and 17 lines have no cost. The package
  trigger fires only on insert or on `treatment_id`/`quantity` updates.
* **The baseline cannot see the likely bug.** Four totals are redundant: payments equal
  revenue by construction and balance is 0.00 by construction. A migration that stamps
  every converted receipt with `current_date` passes all four and destroys the attribution
  model.
* **No RLS DDL exists in the migrations.** The state described in the handoff was applied
  out of band; the runner checks view options and grants, not `relrowsecurity`.

## Goals vs. Non-Goals

* **In-Scope Goals**
  * Ten executable assertions, each returning rows only when violated, run after every
    migration batch and exiting non-zero.
  * A committed baseline: per-sale hash (no patient rows), monthly revenue and cash
    series, and a fingerprint of the money views.
  * One negative control per assertion: break the effect, the test must fail.
  * The workbook and the decisions as the only oracles.
  * A thin manifest joining acceptance criteria, assertions and relations, added after
    the assertions exist.
* **Out-of-Scope Non-Goals**
  * One document section per screen or per branch.
  * 152-cell effect matrices per operation.
  * API contracts: no API exists.
  * `close month` for sales: D4 says it does not exist.
  * Entries for operations that are not callable yet.

## Alternatives Weighed

* **Rejected by the lens:** one catalog entry per operation written now. Six of eight
  describe relations that do not exist, and two are invalidated by migration 32.
* **Rejected by author:** one document per screen. It documents UI, which is out of
  scope, and hides the operation behind a component.
* **Rejected by author:** one document per table. It describes data, not behaviour, and
  the views are rebuilt often enough that the render target moves.
* **Rejected by the lens:** the PRD's criteria as the catalog. Prose cannot run.
* **Rejected by the lens:** documenting "the exact effect on each table" by hand. Observe
  the diff inside the test transaction instead.
* **Chosen:** assertions plus baseline, wired into the existing gate.

## Key Decisions & Staging for Next Steps

1. **Fix the oracles and the reports before anything else.** Correct
   `docs/data/import-reconciliation.md`; decide the single balance identity and make
   `customer_balances` compute it; switch the profitability views to the frozen cost
   columns or state in writing that reports use live catalog cost on purpose.
2. **Freeze the baseline.** 470 sales / 626 lines / 470 payments / 38 zero-amount / 0
   void / 0 installments / 219,492.91 / 0.00 balance, plus per-sale hashes and the
   monthly revenue and cash series. Commit the generator and the hashes, not the rows.
3. **Write the ten assertions.** Balance identity through the view; monthly cash equals
   the workbook; per-sale receipt sum and dates; one `is_first_visit` per customer;
   returns never exceed collected; write-offs never exceed the uncollected amount;
   the reschedule clamp; no receipt against a void installment; void and return are exclusive;
   closed expense months reject inserts.
4. **Wire them into `apply_migrations.py`**, next to the existing lock-down check, with a
   `--dry-run` that runs a migration, the assertions and a rollback.
5. **Decide the callable seam** (one RPC per operation, or one versioned SQL file the
   app executes) before writing any operation test.
6. **Then the manifest**, one row per operation with `status: live|planned`, acceptance
   ids, relations, assertion names and `enforced_by`. A `live` row whose relation or
   assertion is missing fails the checker.

Nothing in this plan waits for the Next.js scaffold, and none of it writes a document
that claims to be E2E.
