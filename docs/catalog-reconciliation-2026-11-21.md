# Catalog reconciliation — 2026-11-21

Source: the owner's master, `catalog - Sheet1.csv` (59 rows, 54 unique names, 5 repeated).
Base: 66 active items (35 treatments, 26 products, 5 services), prices as sold and the cost
interval that covers the day. Tool: [`scripts/reconcile_catalog.py`](../scripts/reconcile_catalog.py).

Applied the same day: migration `20261121150000_product_costs_from_sheet.sql` (20 product
costs), `run_checks.py` green (20 checks, 19 controls), baseline holds at 435 sales.

## Verdict

**Prices: 54 of 54 agree.** The alignment of 2026-11-21 holds; nothing to change.

**Costs: 31 agree, 19 differ, 4 have no amount in the sheet.** Every one of the 19 was a
product on a cost the base had invented (an estimate, then a $1.00 placeholder). A twentieth
product follows the same name as a treatment — Lip Filler — and was added by hand, so the
migration sets 20.

## 1. The 20 costs, as they are now

| Code | Item | Cost in the base before | Sheet cost |
|---|---|---|---|
| PROD-0001 | Arum Fresh | 57.40 | 43.00 |
| PROD-0003 | Arum Microbiota | 50.40 | 29.00 |
| PROD-0007 | Enclomiphen | 105.00 | 37.50 |
| PROD-0008 | Exosomes | 105.00 | 85.00 |
| PROD-0009 | Factor G Serum - Skin Care | 49.00 | 35.00 |
| PROD-0011 | Gluthation Shot | 35.00 | 4.00 |
| PROD-0012 | Insomnitol | 35.00 | 25.00 |
| PROD-0013 | Ipamorelin CJC Injectable | 196.00 | 120.00 |
| PROD-0014 | Ipamorelin CJC Troches | 1.00 | 150.00 |
| PROD-0015 | IV Add-On Circulate | 35.00 | 7.00 |
| PROD-0016 | IV Endo Flow | 1.00 | 52.00 |
| PROD-0017 | LibidoStim F | 1.00 | 35.00 |
| PROD-0018 | Lip Filler (the product row) | 262.50 | 130.00 |
| PROD-0019 | Lipotropic IM | 35.00 | 4.00 |
| PROD-0020 | NAD+ therapy | 182.00 | 74.00 |
| PROD-0022 | NoxSynergy | 60.90 | 43.00 |
| PROD-0027 | Sculptra | 980.00 | 559.00 |
| PROD-0029 | Testosterone Cream | 87.50 | 56.00 |
| PROD-0030 | Testosterone Injecyable | 166.95 | 48.00 |
| PROD-0031 | Vitamine Shots | 28.00 | 4.00 |

"Before" is the May–October interval (`catalog cost, no real effective date`, an estimate at
roughly 70–130% of the price); the November interval was `1.00` for all 20. Both are gone:
each product now carries one interval from 2026-05-01 to infinity with the sheet's number,
and the January–April interval, already the sheet's number, closes on 2026-05-01.

The four active products the sheet does not list no longer read $1.00: migration `20261121160000`
reopened the estimate the base already held for them — Arum Life and Arum Vital at 57.40,
FemGuard and Perform Supplement at 35.00 — so their margin reads 30% instead of 98%. Those are
still estimates; the clinic's purchase cost is what makes them true.

## 2. What the change did to the months (verified against `monthly_pl`)

| Month | Gross margin before | Gross margin after | Change |
|---|---|---|---|
| 2026-05 | 12.328,15 | 12.665,15 | +337,00 |
| 2026-06 | 7.283,06 | 7.527,06 | +244,00 |
| 2026-07 | 12.078,03 | 12.830,23 | +752,20 |
| 2026-08 | 14.732,55 | 15.643,90 | +911,35 |
| 2026-09 | 6.743,80 | 7.385,50 | +641,70 |
| 2026-10 | 11.392,15 | 12.231,00 | +838,85 |
| 2026-11 | 7.106,22 | 6.681,22 | −425,00 |
| **Total** | **71.663,96** | **74.964,06** | **+3.300,10** |

May–October rise because the estimate charged more than the real cost. November falls
because the base had been charging $1.00 from 2026-11-01. Revenue, cash and the closed
expense months do not move: only the cost of the goods reads differently.

Later the same day, `20261121160000` replaced the $1.00 of four products the sheet omits with
the estimate the base already held (57.40 / 57.40 / 35.00 / 35.00). That takes another 90,40
from November: the month reads **6.590,82** and the total **74.873,66**.

## 3. No amount in the sheet (4)

| Item | Sheet says |
|---|---|
| NAD+ IV Series Protocol | Defined in consultation |
| Peptide/IVs Packages | Defined in consultation |
| Energy Precision Endo/Flow - $ IVs series | Defined in consultation |
| Non-Surgical Rhinoplasty | Validate history |

The base already carries these four with no price, so it agrees with the sheet as far as it
goes: the desk picks the price at the sale.

## 4. One name, more than one row (26)

The sheet's Category disagrees with the kind stored in the base in 26 rows. This is the next
decision, and it is not a cost question.

**a. Nine packages stored as unit treatments** — the sale screen does not lock quantity to 1: `TRT-0024` 2 IV + 4 Lipotropic, `TRT-0025` 4 IVs + 6 Lipotropic
Package + Arum, `TRT-0026` Enclomiphen Package, `TRT-0027` Energy Precision Endo/Flow,
`TRT-0029` IV Series, `TRT-0030` LegacyMen 360, `TRT-0031` NAD+ IV Series Protocol,
`TRT-0034` Peptide/IVs Packages, `TRT-0037` Weight Loss Package w/ Semaglutide.

**b. One membership stored as a unit treatment**: `TRT-0028` Eterna IV Series Membership.

**c. Ten products the sheet calls Treatment**: `PROD-0020` NAD+ therapy, `PROD-0032` Biotin
High Concentration, `PROD-0008` Exosomes, `PROD-0011` Gluthation Shot, `PROD-0015` IV Add-On
Circulate, `PROD-0031` Vitamine Shots, `PROD-0019` Lipotropic IM, `PROD-0027` Sculptra,
`PROD-0030` Testosterone Injecyable, `PROD-0016` IV Endo Flow. All ten are in use as products
today, so history sits on the product row.

**d. Three services the sheet calls Treatment**: `SRV-0001` Lab Work, `SRV-0002` Lab Work -
Extended Panel, `SRV-0003` Consultation. Note this contradicts the earlier master, which
listed Consultation as a Service.

**e. Three treatments the sheet calls Product**: `TRT-0022` and `TRT-0023` (the WL GLP-1
monthly supplies), `TRT-0007` Ipamorelin CJC Troche. The sheet lists Ipamorelin as two
products, Troche at 280 and Troches at 300; the base keeps Troche as a treatment and Troches
as a product.

Changing a kind is not a correction the base allows: `sale_items` points at the row by kind,
and `AGENTS.md` forbids changing an item's kind to fix a past sale. Each group is therefore
either left as it is, or given a new row of the right kind for future sales with the old one
retired. The owner's decision, one group at a time.

### One name, two rows, and the live row is not the one with the history

| Name | Package row | Unit row |
|---|---|---|
| Male Optimization - Timmix | `PCK-0017` 1000 / 244 / 4, **active, 0 lines** | `TRT-0012` 1000 / 244, **inactive, 32 lines** |
| Weight Loss Package w/ Semaglutide | `PCK-0015` 1512 / 195 / 4, **inactive, 0 lines** | `TRT-0037` 1512 / 195, **active, 13 lines** |

Both pairs carry the same price and cost, so no money moves either way. The inconsistency is
the sale screen: a Timmix sale today locks quantity to 1 (package), a Semaglutide sale does
not (unit). One of the two pairs should follow the other.

## 5. In the base, not in the sheet (10)

| Code | Item | Kind | Price | Cost |
|---|---|---|---|---|
| PCK-0002 | 4 IVs + 4 Lipotropic Package | Package | 357.00 | 249.90 |
| PROD-0002 | Arum Life | Product | 82.00 | 1.00 |
| PROD-0004 | Arum Vital | Product | 82.00 | 1.00 |
| PROD-0010 | FemGuard | Product | 50.00 | 1.00 |
| PROD-0025 | Perform Supplement | Product | 50.00 | 1.00 |
| TRT-0033 | PRP Microneedling | Treatment | 135.00 | — |
| TRT-0018 | Radiesse | Treatment | 1250.00 | 875.00 |
| TRT-0035 | Regenerative Glow Protocol | Treatment | 1357.50 | — |
| SRV-0004 | Payment completion from another treat. | Service | 362.00 | — |
| SRV-0005 | Remaining Balance | Service | 731.00 | — |

The four products are 4 of the 8 items added from sales with a provisional price; the other
four of those 8 are on this list too (`PCK-0002`, `TRT-0033`, `TRT-0035`, `TRT-0018`). The
sheet lists none of the 8, so it cannot confirm or correct their prices. `4 IVs + 4
Lipotropic Package` is a different item from the sheet's `4 IVs + 6 Lipotropic Package + Arum`.

## 6. Repeated names in the sheet (5)

Arum Fresh, Lab Work, Lip Filler, NoxSynergy, Under Eye Treatment. Each repeat carries the
same cost and price as its sibling, so folding them changes nothing. `Under Eye Treatment` and
`Under-Eye-Treatment` normalise to the same name; the base has both spellings.

## Still open

1. **The taxonomy groups** in section 4: which move, and to what.
2. **The two pairs in section 4**: one shape for Timmix and Semaglutide.
3. **Six costs and eight prices**: Arum Life, Arum Vital, FemGuard, Perform Supplement, PRP
   Microneedling and Regenerative Glow have no cost; none of the 8 items added from sales
   appears on the sheet, so their prices are still the ones read from the sales file.

## Re-run

```
py scripts/reconcile_catalog.py "C:\Users\aguaj\Downloads\catalog - Sheet1.csv"
```

Read-only. The sheet is the master; the script never writes to the base.
