# Next Actions

Punch list. One line per action, imperative, with the owner when it is not me. At session close, finished items are summarised in [`session-summaries.md`](session-summaries.md) and removed from here.

## Blockers

- **None.** The app is deployed and behind the clinic login.

## Waiting on the clinic — Monday 2026-11-23

- [ ] **The 26 kind disagreements in the catalog**, one group at a time: nine packages stored as unit treatments, one membership as a unit, ten products the sheet calls Treatment, three services the sheet calls Treatment, three treatments the sheet calls Product. A kind is never rewritten to fix a past sale. Detail in [`../docs/catalog-reconciliation-2026-11-21.md`](../docs/catalog-reconciliation-2026-11-21.md) section 4.
- [ ] **Six costs and eight prices**: Arum Life, Arum Vital, FemGuard, Perform Supplement, PRP Microneedling and Regenerative Glow have no real cost; the eight items added from sales carry the most repeated price, not a confirmed one. The sheet lists none of them.
- [ ] **The session rule for the 58 incomplete cases**: 50 Tirzepatide and 8 Semaglutide patients are below the minimum of four. Charged, refunded or forgiven — the base reports, it does not decide.

## This side

- [ ] **Prove the sale screen in the clinic**: one real sale from the deployed app, entered at the desk, with the actor recorded. Everything else follows from that.
- [ ] **Confirm the Supabase Auth rate limits are enabled** (Authentication → Rate Limits). The app adds no limiter of its own; this is the accepted control.
- [ ] **Branded PDF** of the patient report (logo, gold and navy per `docs/branding.md`).
- [ ] **Rotate the `sbp_` account token** in the root `.env.local` when the schema work pauses.
- [ ] **Decide the clinic account**: the email that signs in, whether Google sign-in follows, and who resets the password (today: the Supabase dashboard).

## The owner's (screens)

- [ ] The dashboards and the sales report, built with another LLM. This side offers the data contract only.
- [ ] From the UI review: the mobile drawer that never closes, `/expenses/<period>` at 680 px, Returns/Voids losing their action column, catalog names at 84 px, KPI truncation, and the five lint errors inside components. Evidence in the UI review under `shots/`.
