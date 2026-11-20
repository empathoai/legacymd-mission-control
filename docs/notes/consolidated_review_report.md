# Consolidated review: assurance model

**Target:** `docs/assurance-model.md` · **Date:** 2026-11-19
**Reviewers:** design critique, structural, implementation readiness
**Method:** `egm_reviewer` is unavailable in this build, so the three lenses ran as fresh
general-purpose subagents reading their persona files, which is upstream's documented
fallback. Read-only by instruction.

## Verdict

The first version was a diagnosis wearing a plan's clothes. It named the right problem and
proposed ten checks of which, in the reviewers' words, "one is executable and falsifiable
today"; several compared a view to the aggregate that defines it, several referenced
relations that do not exist, and the suite had no runner, no oracle and no control.

The revised document fixes the instrument: six live checks, five explicitly blocked, one
external oracle, a runner outside the migration ledger, a waiver policy, and the balance
identity decided in one place.

## Blockers found, and how the revision resolves them

| # | Lens | Finding | Resolution |
|---|---|---|---|
| 1 | all | No Alternatives section, mandatory in the standard | Added §11 with five rejected instruments |
| 2 | all | Checks 2, 3, 4, 9 reference `payment_receipts`, `sale_refunds`, `adjustments`, `voided_at`, which have no DDL | Status column: `blocked 32`; prerequisites named in §12 |
| 3 | design | Check 4 restated a balance identity that omits `por_devolver`; four formulations existed | §5 defines the identity once, including `por_devolver` and `no_show` |
| 4 | design | Checks 1 and 3 fail open on `NULL` sums | `coalesce` and `is distinct from` required in every check |
| 5 | design | Check 5 was vacuous (`line_cost` is never null) and backwards | C05 now asserts `unit_cost is not null` after the cutover |
| 6 | design | `set_product_cost` rewrites lines and had no row in the map | Added as a live operation with its agreement |
| 7 | design, structural | Check 10 is a tautology: the view is the sum it was compared against | Replaced by C08 against the owner-verified total |
| 8 | design | No independent oracle, no baseline | C08 carries the oracle; §8 defines the baseline and its limit |
| 9 | structural, readiness | Checks claimed to run after every migration; no runner exists | §9 names `supabase/checks/`, `scripts/run_checks.py`, exit code and wiring |
| 10 | design | A binary gate on data that violates the checks by construction | Waivers with owner and expiry; `--strict` mode |
| 11 | readiness | Check 1 contradicts void plus write-off | Identity includes write-offs and excludes void rows |
| 12 | readiness | Check 9 presupposes `paid`, which migration 32 deletes | C09 recast as "a receipt against a void installment is flagged" |
| 13 | readiness | Checks inside migrations would run once, ever | §9 forbids it and explains the ledger |
| 14 | structural | The document duplicated the PRD and the brief, and the two "ten checks" disagreed | One list; the brief keeps the narrative, this file keeps the checks |
| 15 | structural | "Nothing is stored twice" was false | §3 rewritten as "one writable owner, copies guarded" |

## Two defects the reviewers confirmed in the live schema

* `item_profitability` and `monthly_pl` compute cost from the live catalog while the lines
  freeze it. Frozen costs are bypassed by every report.
* `docs/data/import-reconciliation.md` disagrees with the database and was committed.

## What remains blocked

C02, C03, C04, C06, C09 wait on migration 32 or on `item_price_history` and the
`backfilled` marker. They are listed with the word `blocked` instead of being claimed as
coverage.
