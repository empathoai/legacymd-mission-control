# Appointments and customer master

* **Author:** empathoai
* **Date:** 2026-11-19
* **Status:** model agreed with the owner; ready for a design document

## Overview

The clinic books patients through an external bot that owns availability, and today records
the bookings in Excel. This module records the booking and its outcome. It is a log, not a
scheduler: it does not check overlaps, does not model capacity and does not decide who
attends. Availability stays with the bot and the clinic.

**Everyone who books enters the customer master.** There is no separate lead table and no
lead/customer distinction: the clinic knows its patients, searches by name, and creates the
customer when the name is new. A no-show leaves a customer who never bought; that is
accepted.

**Conversion is the first attendance**, not the first purchase. If a patient books, does not
come, and later comes, that attendance is the conversion. **LTV is everything she bought
afterwards.** Both are read from the appointment and the sale link.

## The model

1. `customers` is the master of people. It gains `phone` and `birth_date`, both optional.
2. At booking the staff search by name. A match links the booking to that customer; no match
   creates the customer with the name, phone and birth date. `appointments.customer_id` is
   therefore `not null`.
3. `appointments` records the slot, the expected category, the source and the status. The
   category is what the clinic expects; the doctor chooses the exact treatment at the visit,
   and the sold category lives on the sale line.
4. Status is `booked → show_up | no_show | cancelled`, terminal once. A resolved row never
   changes; a correction is a new reasoned booking, not a rewrite.
5. A sale on that visit links through `sales.appointment_id`, written once at sale insert.
   The original package is never touched: an upsell is another line or a later sale.
6. Conversion = the first `show_up` of a customer. Show-up and no-show rates are computed per
   week on appointments, not on customers.
7. LTV = revenue from `sales` for that customer across time.

Nothing here creates, moves or reads money. `customer_balances`, `cash_expected`,
`monthly_money` and the balance identity stay exactly as they are, and no money view joins
`appointments`.

## Metrics

| Metric | Definition | Grain |
|---|---|---|
| Bookings | appointments created | week / month |
| Show-ups | `status = 'show_up'` | week / month |
| No-shows | `status = 'no_show'` | week / month |
| Show-up rate | show-ups ÷ (show-ups + no-shows) | week, Monday to Saturday, by `scheduled_on` |
| Cancelled | `status = 'cancelled'`, reported apart | week / month |
| Unresolved | `status = 'booked'` and the slot is past | live list |
| Conversion | first show-up per customer | month |
| LTV | revenue per customer from `sales` | per customer |

`cancelled` and `unresolved` never enter the show-up rate, and a week with no resolved
appointments returns no rate instead of 0%. `visits` in the existing views keeps meaning
purchases and is never summed with show-ups.

Because a booking creates a customer, a no-show would otherwise appear in `customer_balances`
with 0,00. The module therefore narrows that view to customers with at least one money fact —
a sale, an adjustment, a receipt or a return. A no-show has none, so it never appears there;
the customer directory reads `customers`. The twelve customers who currently sit in the view
with 0,00 leave it, which loses nothing.

## What the six lenses changed

* The word *lead* is gone. It was the one word this project exists to disambiguate, and it
  caused a 3x inflation in the workbook.
* The booking always resolves to a customer, so identity is decided once, by a name search,
  and never by a phone key. No CRM integration is assumed.
* Three times, not one: `scheduled_at` for the slot, `scheduled_on` (generated in
  `America/New_York`) for every attendance metric, `resolved_at`/`resolved_on` for the audit
  of when the outcome was marked. The weekly rate never groups by `resolved_on`: a no-show
  marked late would land in the wrong week.
* Status carries its actor, its moment and its reason; a resolved booking is final.
* The sale link points from `sales`, the owner of the money fact.
* New tables get RLS enabled with zero policies, and C11 asserts it.
* `birth_date` stays because it eases the handoff to Patient Fusion, but it is optional and
  never selected by a report.

## Goals vs non-goals

**In scope**

* Record a booking: customer, slot, expected category, source, phone, birth date.
* Resolve it once: `show_up`, `no_show` or `cancelled`, with actor, moment and reason.
* Reschedule with a full audit chain.
* Link the sale of the visit through `sales.appointment_id`.
* Weekly show-up and no-show rates, monthly conversion and LTV, all from the cutover
  `2026-11-20`.
* Checks with negative controls, in the existing style.

**Out of scope**

* Availability, overlap prevention, capacity, provider or room.
* Reminders, confirmations, messaging.
* No-show fees. Marking `no_show` never creates money.
* Bot writes. No `booked_via`, no `external_ref`; the clinic enters the bookings by hand.
* Backfilling the 432 historical sales with synthetic appointments.
* Generating package sessions automatically. The clinic books them by hand; a redemption
  visit is a show-up with no sale and does not convert.

## Schema decisions

* `customers`: `phone text null`, `birth_date date null check (birth_date between '1900-01-01'
  and current_date)`.
* `appointments`: `customer_id not null`, `scheduled_at timestamptz not null`,
  `scheduled_on date generated always as ((scheduled_at at time zone 'America/New_York')::date)
  stored`, `expected_category_id not null`, `source_id not null`, `status`, `resolved_at`,
  `resolved_on`, `resolved_by`, `cancel_reason`, `created_at`, `updated_at`, `updated_by`.
  The phone and the birth date live on the customer, not on the booking.
* `sources` is an open catalog: the clinic can add a channel when it appears. The five seeded
  values stay; no `walk_in` and no `other`.
* `sales.appointment_id uuid null references appointments(id) on delete restrict`, with a
  partial unique index; written once at insert.
* `appointment_changes`: from, to, when, who, why, append-only, written by
  `reschedule_appointment`.
* Edits to name, phone, birth date and source are allowed while the booking is `booked`, and
  each writes `updated_at`/`updated_by`. A resolved booking is not editable.
* RLS enabled with zero policies on both new tables.

## Checks to add

| Check | Asserts | Control |
|---|---|---|
| C14 | a resolved booking has `resolved_at`, `resolved_on` and `resolved_by`; no booking leaves a terminal state | set a status without the controls |
| C15 | a linked sale belongs to the same customer as the booking and the booking is `show_up` | link a foreign sale |
| C16 | the funnel reconciles per week and month: `bookings = show_ups + no_shows + cancelled + unresolved` | flip one status |
| C17 | every show-up either has a linked non-voided sale or is visibly unresolved in the working list | delete the link |
| C11+ | every table in `public` has `relrowsecurity` | create an unprotected table |

## Staging

* **Stage 1:** `customers` gains phone and birth date; `appointments` and
  `appointment_changes`; `resolve_customer(name)` as the only writer of the master from this
  flow; RLS; checks. The clinic records bookings, resolves them and reads weekly rates.
* **Stage 2:** the sale entry screen accepts an appointment context, so `sales.appointment_id`
  starts filling and conversion becomes measurable.
* **Stage 3:** package sessions and bot ingestion, if the clinic asks for them.

## Risks left open

* A no-show leaves a customer with no purchase. The master grows with people who never came.
  Accepted by the owner.
* Two patients with the same normalized name cannot coexist while
  `customers.normalized_name` is unique. If it happens, the clinic writes the full name to
  distinguish them. No schema change.
* Bookings are kept indefinitely for reactivation campaigns. There is no purge, and the
  privacy decision is written here rather than left implicit.
* There is no auth flow yet, so `resolved_by` and `updated_by` are free text: `'clinic'` for
  hand entry, `'system'` for imports.
