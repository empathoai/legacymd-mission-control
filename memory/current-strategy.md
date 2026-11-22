# Current Strategy

The *now* state, not history. If this file is older than 7 days, treat it as stale and ask before acting on it.

_Last review: 2026-11-21_

## Now

**The app is live.** `real-darkgray-tarsier-88.hostingersite.com`, Hostinger, Node 22, npm, `next build --webpack`, deployed from `master` on every push, behind the clinic login. [`../docs/deploy-hostinger.md`](../docs/deploy-hostinger.md) holds the panel settings and the failure modes; [`../docs/security-review-2026-11-21.md`](../docs/security-review-2026-11-21.md) holds the security pass (CSP, HSTS, frame denial, httpOnly cookie, no framework banner).

The base is the owner's consolidated workbook: **189 customers**, 435 sales, 588 lines, **219.460,91** collected, **0,00** owed, gross margin **74.873,66**, 119 migrations applied, **22 checks each with a control**, and `docs/data/baseline.json` holding at 435 sales. November reads **18.599,92**, and the six closed expense months still match the sheet to the cent. The 20 product costs came from the owner's sheet and are backdated to 2026-05-01; four products the sheet omits carry the estimate the base already had (57,40 / 57,40 / 35,00 / 35,00) and two have no cost at all.

**Appointments left the system on 2026-11-21.** The clinic keeps its diary outside and logs only the patients who arrive, so the tool records patients and sales only: no agenda, no show rate, no booking webhook, no `/api` route. `visit_number` is the **purchase ordinal** — 1 is the first business day with a sale — and the 13 gaps in the imported history are inherited from the workbook, never produced forward. The 51 imported rows are archived in `docs/data/appointments-2026-11-21.json`.

**Sessions belong to the patient's plan.** `treatments.sessions_minimum` is 4 on the two weight-loss programs; `session_progress` and `session_gaps` report what happened and are information for the desk, not a queue of corrections. A visit with no money is not a sale and is not recorded.

**The past is frozen.** No restatement, no backfill, no correction of a historical margin or a missing session. `docs/data/baseline.json` and `C18` are the guard; the work from here serves the current month forward — every visit that happens is recorded, nothing is recorded at zero.

**Screens are the owner's.** The owner builds them with another agent. This session keeps the base, the migrations, the checks, the data contracts and the server actions, and answers what the other side asks. It redesigned the sign-in screen once because the owner asked for it directly.

**The dashboards and the sales report are the owner's too**, built with another LLM. The data layer behind them is finished (`monthly_pl`, `cash_collected`, `monthly_money`, `sale_money`, `customer_balances`, `session_progress`); this session offers the contract and stays out of the drawing.

A sale is written only through `create_sale(...)`: the sale, its frozen list prices, the plan and the receipts land atomically, `visit_number` and `is_first_visit` are derived, and a first visit requires a source. Corrections are append-only: a void marks the sale, a return is a new row, and the line guards refuse an edit or a delete. A cancelled installment writes off what it still expected, so the balance stops charging it. Every date stays inside its sale; a future or out-of-order date is refused by the table itself.

The vocabulary is one rule: the schema says `customer`, the screen says `patient`, and the seam is the value. `lib/customers.ts` is the single reader of the master; no page shows the word "customer". Copy is neutral and `scripts/check_copy.py` enforces it.

## Next 30 days

1. **The clinic's answers, Monday 2026-11-23**: the 26 kind disagreements in the catalog (nine packages stored as units, one membership, ten products the sheet calls Treatment, three services, three treatments the sheet calls Product) and the six costs / eight prices the sheet does not list. Evidence in [`../docs/catalog-reconciliation-2026-11-21.md`](../docs/catalog-reconciliation-2026-11-21.md).
2. **Prove the sale screen in the clinic**: one real sale entered at the desk, from the deployed app, with the actor recorded. Everything else follows from that.
3. **Check the Supabase Auth rate limits** are enabled (Authentication → Rate Limits); the app adds no limiter of its own and that is the accepted control.
4. Branded PDF of the patient report.
5. Rotate the `sbp_` account token in the root `.env.local` when the schema work pauses.

## Not doing

- **The dashboards and the sales report**: the owner builds them with another LLM. Offer the data contract, not the screen.
- Lifetime value, recurrence curves and "last treatment" analytics. The data supports them later, but they are out of the MVP.
- Upselling recommendations: business strategy, not a data problem.
- Package composition (what is inside a package). The owner writes it as free text.
- Per-user data isolation. One clinic, one staff account is enough; access is server-only.
- An application-level login rate limiter: Supabase Auth and the CDN already bound it, and an in-memory limiter would be theatre.

## Decisions backing this strategy

- See [`decisions.md`](decisions.md) and `docs/HANDOFF.md`.
