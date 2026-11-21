# End-to-end flow review — 2026-11-21

Browser only (Playwright, Chromium, headless), desktop 1440×950 and mobile 390×844,
dark theme (`localStorage.theme = "dark"`). App: `next dev` at `http://localhost:3000`.
Captures in `shots/` (gitignored).

**The base was not written to.** Every count was identical before and after the session:

| | before | after |
|---|---|---|
| customers | 189 | 189 |
| sales | 435 | 435 |
| sale items | 588 | 588 |
| receipts | 435 | 435 |
| returns | 0 | 0 |
| expense entries | 106 | 106 |
| voided sales | 0 | 0 |
| collected | 219.460,91 | 219.460,91 |

Anything that would write was driven only to the point where the guard rejects it, and
that is stated below where it applies.

---

## 1. Flow table

| # | Flow | Verified | Result | Evidence |
|---|---|---|---|---|
| 1 | Login + every sidebar route (13 routes × 2 viewports) | Browser | **OK**, with notes | `flow1-desktop-*.png`, `flow1-mobile-*.png`, `flow1-desktop.json` / `flow1-mobile.json`, `flow1b-login.png` |
| 2 | Patients: search, open a patient with sales | Browser | **OK**, 1 console bug | `flow2-desktop-01..06`, `flow2.json`, `flow2-detail.json` |
| 3 | `/sales/new`: picker, line, total, plan, draft, validations | Browser | **OK**, 2 notes | `flow3-desktop-01..19`, `flow3.json`, `flow3b.json`, `flow3c.json` |
| 4 | Sales details: day/range, pagination, footer total, open a sale | Browser | **OK** (totals match the DB exactly) | `flow4-desktop-01..07`, `flow4.json`, `flow4b.json` |
| 5 | Returns + Voids: empty states, action, patient search | Browser | **OK**, 1 copy note | `flow5-desktop-01..07`, `flow5.json` |
| 6 | Open items + Expenses: totals, closed months, dialogs | Browser | **OK** | `flow6-desktop-01..10`, `flow6.json`, `flow67.json` |
| 7 | Catalog: five tabs, search, margin, edit dialog | Browser | **OK**, 1 note | `flow7-desktop-01..05`, `flow67.json` |
| 8 | Odd cases: bad URLs, reload, double click, Back | Browser | **OK except one** (see F1) | `flow8-*.png`, `flow8.json`, `flow10-*` |

Nothing in the table is "code reading only" except where explicitly marked **code**.

---

## 2. Failures and oddities, by severity

### F1 — A malformed patient id shows the error screen with the raw database message (medium)

**Reproduce:** open `http://localhost:3000/patients/not-a-uuid`.

**Expected:** the in-shell "Patient not found" state (the one a *valid but unknown* uuid
already gives).

**Happened:** the app error boundary: "This screen could not load / Nothing was saved or
changed…" with the Postgres text in a monospace box:
`customer query failed: invalid input syntax for type uuid: "not-a-uuid"`.
HTTP status 200. In dev the React overlay also shows "1 Issue".

**Cause:** `getCustomerDetail` sends the raw segment to Postgres, which rejects it before
any "not found" path can run — so the page throws instead of falling through to
`notFound()`. `app/(app)/error.tsx` deliberately prints `error.message`, so in production
the owner still sees a database string (production replaces it with a generic digest
message, but the screen is still "could not load", not "patient not found").

**Evidence:** `shots/flow8-desktop-04-patient-bad-uuid.png`.

**Contrast, same class, already correct:** `/patients/00000000-…` (valid uuid, no row) →
"Patient not found — It may have been removed. Go back to the report and search again."
(`flow8-_patients_0000…png`), and `/expenses/2099-01-01` → the in-shell not-found card.

### F2 — Not-found screens answer HTTP 200 instead of 404 (low)

**Reproduce:** `curl -I http://localhost:3000/expenses/2099-01-01` (also
`/sales/<unknown uuid>`, `/expenses/not-a-period`).

**Expected:** 404, like `/foo-bar-nope` does.

**Happened:** 200 with the in-shell card "That page does not exist" (visible, correct copy,
two ways out). Only the status code is wrong. Harmless to the owner, wrong for any
monitoring or crawler, and it makes "did that URL work?" untestable from the headers.

**Evidence:** `flow8.json` (`status: 200` for the three in-shell cases vs `404` for the
root route), `flow8-desktop-03-sale-not-found.png`.

### F3 — React: "Can't perform a React state update on a component that hasn't mounted yet" on `/patients/report` (low)

**Reproduce:** open `/patients/report`, watch the console.

**Expected:** no console error.

**Happened:** the error above on load, and again after a search. It is a real side effect
in a render path (a component setting state before mount), not a warning. No visible
symptom found: the KPIs, chart, tabs, table and pager all render and update correctly.

**Evidence:** `flow2.json` step 1 and step 2.

### F4 — `/patients/report` scrolls sideways on a 390 px screen (low)

**Reproduce:** 390×844, open `/patients/report`.

**Expected:** no horizontal scroll.

**Happened:** `scrollWidth` 404 vs `clientWidth` 390. The culprit is the tabs strip
(`Directory | VIP & Rewards (108) | Upsell & Recall (177)`), measured at 404 px — not the
table, which has its own scroll container. Every other screen checked is exactly 390
(`/`, `/sales/new`, `/sales/details`, `/expenses`, `/catalog/treatments`, `/sales/returns`,
`/open-items`).

**Evidence:** `flow10-mobile-01-patient-report-overflow.png` (the full-page capture is
404 px wide), `flow10.json`.

### F5 — The patient search treats `%` and `_` as patterns (low)

**Reproduce:** `/patients/report?q=%25` (a literal `%`) or `?q=_`, or type `%` in the box
on Returns/Voids.

**Expected:** no match, or an "invalid characters" answer.

**Happened:** `%` and `_` return a full page of patients (everyone); `%zzz` returns none.
The value is passed to PostgREST's `ilike` unescaped, so it is a *pattern*, not a term.
Not injection (the call is parameterised), and read-only, but a search accepts characters
it should neutralise.

**Evidence:** measured in the browser: `q=%` → 20 rows (a full page), `q=_` → 20 rows,
`q=%zzz` → the empty state.

### F6 — Copy and label oddities (low, cosmetic)

| Where | What | Evidence |
|---|---|---|
| `/patients/report` search result count | `1 patients` (no singular form) | `flow2.json` step 2 |
| Patient detail subtitle | "patient since **Nov 2026**" while the first purchase is **May 2, 2026** — it reads `customers.created_at` (the import date), not the first sale | `flow2-desktop-05-patient-detail-direct.png` |
| Return dialog description | "...collected on **2026-10-30**" — raw ISO date, while every table on the same screen uses `Oct 30, 2026` | `flow5-desktop-03-return-dialog.png` |
| Catalog, a search with no match | "Nothing here yet / Use the New button to add the first one." — the catalog is not empty, the filter is | `flow7-desktop-03-catalog-empty-search.png` |
| `/settings` | Reachable from the sidebar, but it is a `ModulePlaceholder` ("Channels…", "Payment methods…", "Team access…") — promises screens that do not exist | `flow1b-settings.png`, `settings/page.tsx` |
| Sale detail top bar | Shows "LegacyMD" instead of "Sale" (every other route names its section) | `flow4-desktop-05-sale-detail.png` |
| Sidebar footer | Shows a lone user icon with no name in dev (no session) | all desktop captures |

### F7 — The sale form relies on the browser for three invalid values (low)

**Reproduce:** `/sales/new`, one line, then type `0` in Qty, `-100` in Unit price, or `1.5`
in Qty, and press "Record sale".

**Expected:** the app's own message ("Every line needs a quantity above zero." /
"…must have a unit price and total greater than $0.00.").

**Happened:** the browser blocks the submit with its native bubble ("Value must be greater
than or equal to 1.", "…0.", "Please enter a valid value…"), and the app's message never
appears. The rest of the guards do fire correctly (see §4). Two side effects: the browser
bubble is English browser UI, not the app's voice, and while the field is invalid the
Lines header still prints the arithmetic — `Total $0.00` for qty 0, `Total -$100.00` for a
negative price.

**Evidence:** `flow3-desktop-13b-qty-zero.png`, `flow3-desktop-15b-price-negative.png`,
`flow3c.json`.

### F8 — Notes, not defects

- "Previous / Next" render as `<a role="button">`; keyboard and middle-click work, but a
  screen reader announces a button and `getByRole('link')` does not find them.
- Returns and Voids default to **today only** (by design per `lib/returns.ts`: "the day or
  the patient"). With no sale today the section reads "Nothing to return today", so
  returning yesterday's money requires knowing the patient's name.
- `page=999` on Sales details silently shows the last page (`Page 30 of 30`, 8 rows); no
  error, no redirect. Acceptable, worth knowing.

---

## 3. Loading, error and empty states

| State | Exists | Visible in the browser? | Evidence |
|---|---|---|---|
| Loading | `app/(app)/loading.tsx` — a `role="status"` skeleton (title bar, 4 KPI blocks, table block) | **No, not in dev.** During a client navigation the previous screen stays on screen until the new one is ready (I delayed the RSC fetch by 4 s and still saw the old screen). Correct Next.js behaviour; the skeleton is a fallback that a fast local DB never shows. **Code only.** | `flow10b.json` |
| Error | `app/(app)/error.tsx` — "This screen could not load", "Nothing was saved or changed", the raw message, "Try again" + "Back to the dashboard" | **Yes**, triggered by F1 (`/patients/not-a-uuid`) | `flow8-desktop-04-patient-bad-uuid.png` |
| Empty — sales details | "No lines in Nov 21, 2026 / Pick another period, or record a sale." | Yes | `flow1-desktop-sales_details.png` |
| Empty — returns | "Nothing to return today" / with a search: "That patient has nothing to return" | Yes | `flow5-desktop-01`, `04` |
| Empty — voids | "Nothing to void today / A sale appears here only when nothing was collected."; search: "No sale has been voided." | Yes | `flow5-desktop-05`, `06` |
| Empty — open items | "Nothing is expected / Every sale is collected." (0 installments, $0.00 overdue) | Yes | `flow6-desktop-01-open-items.png` |
| Empty — patient search | "No patient matches / Try another spelling, or clear the search." | Yes | `flow2-desktop-03-search-empty.png` |
| Empty — catalog search | "Nothing here yet" (see F6: wrong copy for a filtered list) | Yes | `flow7-desktop-03-catalog-empty-search.png` |
| Not found — in-shell | Card "That page does not exist", Back to the dashboard, Expenses | Yes (200, F2) | `flow8-desktop-03-sale-not-found.png` |
| Not found — no patient | "Patient not found / It may have been removed…" | Yes | `flow8-_patients_0000…png` |
| Not found — outside the shell | `/foo-bar-nope` → 404 page | Yes | `flow8.json` |

The empty states are real, worded in the owner's language, and each offers a way out. None
of them is a bare "no data".

---

## 4. Inputs and forms that take invalid data

| Input | What it accepts | Verdict |
|---|---|---|
| Sales details `?date=` / `?from=` / `?to=` | `?date=not-a-date` → falls back to today, empty state, no error | Safe |
| Sales details `?page=` | `-5` → page 1; `999` → last page | Safe |
| Sales details `?from=…&to=…` | No bounds: `from` after `to` → 0 rows, no message | Harmless |
| Patient search `q` (report, returns, voids) | `%` and `_` are SQL LIKE patterns → "everyone" (F5) | **Should be escaped** |
| `/sales/new` — Qty | `0`, `1.5`, `-1`: blocked by the browser, not the app (F7) | Blocked, wrong voice |
| `/sales/new` — Unit price | `0` → app message "…greater than $0.00"; `-100` → blocked by the browser (F7) | Blocked |
| `/sales/new` — custom line | Empty description → "Every custom line needs a description."; no price → "…must have a unit price…" | Correct |
| `/sales/new` — no patient / no lines / new patient with no source / plan that does not sum | "Select a patient first." / "Add at least one line." / "A new patient needs a source." / "$2,765.00 is still unscheduled." (+ the same figure inline at the footer before submitting) | Correct |
| `/sales/new` — inline "Create and use" | Empty or 1-character name → "A name of at least 2 characters is required."; phone strips non-digits (`abc12-34xyz` → `1234`) | Correct, **no write** |
| Return amount | `max` = remaining, `min` = 0: `999999` → "Value must be less than or equal to 335." (browser) | Blocked (client) |
| Add expense, empty | "Pick the expense." — dialog stays open, nothing written | Correct |
| New treatment, empty | "A name of at least 2 characters is required." — stays open, no POST | Correct |
| Close/Reopen month, empty reason | Dialog stays open (not submitted) | Correct |
| Login, empty | `required` fields → browser blocks; no server call | Correct |

Two guards I could only confirm from the client side (see §5): the return amount and the
expense amount are also checked by the server action, and I did not push a valid payload
to prove it.

---

## 5. What could not be tested without writing to the base

Everything below was driven to the last screen **before** the write and then abandoned.

| Flow | Why not | Where I stopped |
|---|---|---|
| Recording a sale (`Record sale`) | Creates a sale + items + a receipt; a sale is immutable and undeleable | Form filled, every guard exhausted, never submitted with a valid payload |
| Recording a return | Creates a `sale_refunds` row | Dialog opened with the real amount and method, then Cancel/Escape |
| Settling a pending return | Writes `state` + `refunded_at` | No pending return exists (0 returns); table shows "No returns recorded yet." |
| Voiding a sale | No sale is voidable: all 435 have receipts, and `void` is only for sales with no money. `voids` correctly shows "Nothing to void today" | Nothing to click |
| Open items: record a receipt / cancel an installment | Balance outstanding is 0,00, so there are no pending installments: the section shows "$0.00 expected · 0 overdue" and "Nothing is expected" | Empty by data, not by design |
| Adding or editing an expense | Writes `expense_entries` | "Add expense" opened, empty save rejected, Escape |
| Closing / reopening a month (May) | Writes `expense_month_changes` and freezes/reopens the month | Reopen dialog opened, Escape. (The Close dialog also reveals the frozen total: $30,365.33.) |
| Creating a patient (`/patients/new`, or "Create and use") | Writes `customers` | Empty-name and 1-character guards only |
| Catalog create / edit / cost change | Writes catalog rows, price intervals and cost history (`set_item_cost`) | Dialogs opened, empty save rejected, Escape |
| Login with the clinic account | No credentials, and `web/proxy.ts` skips the gate while `NODE_ENV !== "production"` | `/login` renders (email, password, Sign in, `required`); the dev app opens without it |
| Production behaviour of the gate, and the 404 status under `next start` | Needs a production build | Out of scope here (F2 is a dev observation; re-check after a build) |

Two flows deserve a second look in production specifically: the 200-instead-of-404 of F2
and the gate.

---

## 6. What was verified positively (the short list)

- Every sidebar route loads with no console error and no failed request (13 routes,
  1440 and 390): `/`, `/sales/new`, `/patients/report`, `/patients/new`, `/sales/details`,
  `/open-items`, `/sales/returns`, `/sales/voids`, `/reports`, `/sales/report`,
  `/expenses`, `/catalog/*` (5 tabs), `/settings`.
- Mobile: the sidebar becomes a sheet with all 13 links, closes on navigation; the sale
  form, the returns dialog (358 px wide inside 390) and the catalog (Cost/Margin collapse
  into the name cell) all fit.
- **Totals match the database, exactly.** May 2026 range: 76 lines, footer **36,732.50**
  (DB: 76 / 36.732,50), 4 pages. Whole history: **588 lines, footer 219,460.91** (DB:
  588 / 219.460,91), 30 pages. November receipts on Open items: **18,599.92**, the number
  in `docs/HANDOFF.md`.
- The sale draft is real: with a patient, 2 lines, an installment and notes, going to `/`
  and back restores everything and shows "This sale was kept in this browser. Nothing was
  lost."; a reload does the same; "Start over" clears it. `sessionStorage`, 12-hour expiry,
  `beforeunload` warning.
- Adding a line updates the total at once ($2,220.00 Botox Membership → $2,770.00 with a
  $550 Filler Syringe); the plan auto-fills the gap ($0.00 balance due) and the
  "still to schedule" figure appears inline and on submit.
- Double-clicking a catalog result adds exactly one line; double-clicking "Record sale"
  with a plan that does not sum yields one message and no request.
- Catalog: 37 treatments + 17 packages + 1 membership + 33 products + 5 services = 93,
  matching `docs/HANDOFF.md`; margin column present (`$39.00 47.6%`), search by name and
  code works (`botox` → 1 row, margin 69.4%), edit and create dialogs open and close
  without a POST.
- Reload keeps filters and page (`?from=…&to=…&page=2` → "Page 2 of 4"), keeps the dark
  theme, and Back after a search returns to the unfiltered list.
- Rapid triple navigation ends on the last route; double-clicking a sidebar link does not
  double-navigate.

---

## 7. Suggested order of work

1. **F1** — validate the id shape before the query (or catch the Postgres error) and fall
   through to `notFound()`. It is the only case that shows a database string to the owner.
2. **F2** — return 404 from `notFound()` inside the app shell.
3. **F5** — escape `%` and `_` in the patient search.
4. **F3** — fix the pre-mount state update on `/patients/report` (console-only today).
5. **F4** — the tabs strip overflow at 390 px.
6. **F7**, **F6** — copy and constraint messaging, cosmetic but visible to the owner.

`shots/` holds every capture named above; the JSON next to it holds the measured values
(status, timings, row counts, totals) so each claim can be re-checked without re-running
the browser.
