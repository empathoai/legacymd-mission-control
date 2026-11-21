# Appointments leave, and what takes their place — 2026-11-21

The owner spoke with Legacy MD: the clinic does not log no-shows. The workbook records the
patients who arrived; the diary lives outside, scheduled by someone else. So this system
records **new patients and new sales only**, and the agenda, the show-up rate and the booking
machinery go.

## 1. What falls, exactly

Inventoried from the base, so nothing is missed:

| Object | Kind | Why it goes |
|---|---|---|
| `appointments` | table | nobody books here any more |
| `appointment_changes` | table | its audit only existed because bookings moved |
| `appointment_funnel`, `appointment_conversion` | views | they measure bookings that no longer exist |
| `book_appointment`, `book_appointment_external`, `resolve_appointment`, `reschedule_appointment`, `link_sale_appointment`, `guard_appointment`, `appointment_changes_immutable` | functions | the chain they enforce is gone |
| `sales.appointment_id` | column | a sale no longer points at a booking |
| `C14`, `C15`, `C17` | checks | they guard the chain above |
| `/api/ghl/appointments`, `lib/ghl` | route and client | the dormant webhook has no feeder and no target |
| `/appointments` and the sale screen's appointment picker | screens | the owner's |
| show-up rate on the dashboard | KPI | the owner's |

What survives untouched: customers, sales, sale lines, the payment plan and receipts, returns,
voids, expenses, open items, the catalog. No sale, amount or line changes.

## 2. A visit changes meaning

Yesterday: a visit was a day with a sale, and a visit with no purchase was an appointment with
`show_up`.

From now on: **a visit is a day with a sale.** A day with no sale is not a record. The ordinal
`visit_number` is derived from the sales alone, 1 being the first.

That exposes a real hole, and the decision is to leave it alone. **Thirteen patients** have
ordinals that skip a number or start above 1 — `Luis Gonzalez` (one sale, visit 2) and
`Sandra Rodriguez` (sales at visits 2 and 3) are the clearest. Twelve of the thirteen skips
match a no-purchase day exactly; the thirteenth (`Patrice Bourgier`) has a no-purchase visit
*after* her last sale, where no row exists to hold the ordinal.

The first version of this document said "renumber every patient from the sales". That is
wrong, and the council of 2026-11-21 killed it: `is_first_visit` is tied to `visit_number = 1`
by constraint, it is hashed in `docs/data/baseline.json`, and the owner froze the imported
history. Renumbering would move the new-patient KPI and fail the baseline. The migration
`20261121260000` instead redefines the column: `visit_number` is the **purchase ordinal**, and
the inherited gaps stay as a documented limit.

The 51 appointments are frozen in `docs/data/appointments-2026-11-21.json` (ids and dates,
never a name) before anything is dropped. The 24 show-up days of the weight-loss patients
remain a question of money, not of ordinal: if those visits consumed a prepaid session, the
session has to be reconstructed from the sales and the package.

## 3. Zero-value validations

The clinic's sentence — "no es gratis" — is the rule: **nothing in this system is worth
zero.** Four places to enforce it, at the write, not only in a report.

1. **A line** must have `quantity > 0`, `unit_price > 0` and therefore `line_total > 0`. A
   trigger refuses anything else, with the message *"A line must have a quantity and a price."*
2. **A sale** must total more than zero and must have at least one line. `create_sale` already
   requires the payment plan to equal the total; it gains the total itself.
3. **Money** must be positive: a payment installment `amount > 0`, a receipt `amount > 0`, and
   a receipt never larger than what the installment still expects (already true).
4. **A visit with no money is not a sale.** If a patient came and paid nothing, exactly one of
   two things is true, and the desk has to say which:
   - it was a session already paid inside a package → the visit is a **consumption**, and it
     carries the value the package allocated to it, not zero;
   - it was not a sale at all → it is not recorded, because appointments are gone.

   The refusal names both ways out; it does not guess.

A check joins them: no sale with `total <= 0`, no line with `line_total <= 0`, no receipt with
`amount <= 0`, and no consumption without a paid package behind it.

## 4. Sessions and how the value is split

The catalog says how many sessions an item includes; the patient decides how many are taken.
Those are two numbers, and the gap between them is the question the system must ask rather
than answer.

- `treatments.sessions` (integer, nullable) — sessions included in the item, per the clinic.
- For each patient × treatment: `sessions_included` (catalog), `visits` (distinct sale days for
  that item), `paid` (what was collected), `allocated` (paid ÷ visits).

Three cases, and only one of them is silent:

| Case | What happens |
|---|---|
| visits = sessions | the value splits evenly: 1.980,00 over 4 visits = 495,00 each. Nothing to ask. |
| visits > sessions | the extra sessions are not covered by the package. **Ask**: charged separately, a second package, or written off — and a write-off is an adjustment, never a zero line. |
| visits < sessions | the patient did not finish. **Ask**: refunded (a return), still owed (an open item), or forfeited (an adjustment). |

The "ask" is a block, not a prompt that can be dismissed: the package stays `open` in a
`package_split_cases` view until someone answers, and no allocation is written while it is
open. That is the only way the split stays true — the alternative is a number invented to make
a report add up, which this base forbids.

## 5. What the numbers become

- **Visits** = distinct days with a sale. Yesterday's count included show-up days; it will drop
  by the 24 weight-loss show-ups and the other imported appointments.
- **New patients** = patients whose first sale falls in the period. Unchanged.
- **Show rate**: gone. Nothing else depended on it.
- The "82 packages, 18 abandoned, 18.709,53 pending" reconstruction was built on a 4-charge
  package. It has to be rebuilt on sessions once the clinic gives the counts.

## 6. Who does what

Data side, this session: the migration that drops the objects in section 1, the renumbering of
`visit_number`, `treatments.sessions`, the `package_split_cases` view, the zero-value triggers
and checks, and the function changes behind them.

Screens, the owner: remove the agenda and its route, the show-up rate, the appointment picker
in the sale screen, and the GHL route if it is still linked from anywhere.

## 7. What the clinic has to answer

1. **Sessions per item**: Tirzepatide, Semaglutide, Timmix, Regenerative Glow, and every other
   package — how many sessions does each include?
2. **Extras and shortfalls**: what happens when a patient takes more, and when they take fewer?
3. **The 51 historical appointments**: archive the tables as history, or drop them entirely?
4. **The 24 weight-loss visits with no sale**: were they prepaid sessions? If yes, they are the
   first test of the split rule.
