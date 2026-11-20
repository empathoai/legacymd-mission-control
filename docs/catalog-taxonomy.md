# Catalog taxonomy

One page, so nobody edits rows at midnight to fix a classification.

## The four kinds

| Kind | What it is | Table | Code | Examples |
|---|---|---|---|---|
| **Treatment** | A clinical act on the patient: an injection, a peel, an IV. Sold per session. | `treatments`, `unit_type = 'unit'` | `TRT-` | Botox Treatment, IV Single, Microneedling Treatment |
| **Package** | Several sessions of one or more treatments, sold once, with a duration in months. | `treatments`, `unit_type = 'package'` | `PCK-` | Weight Loss Packages w/ Tirzepatide, 4 IVs + 6 Lipotropic Package + Arum |
| **Membership** | A recurring plan with a fixed fee that gives access to a benefit for a period. | `treatments`, `unit_type = 'membership'` | `MEM-` | Botox Membership, Eterna IV Series Membership |
| **Product** | A physical item handed to the patient. It has stock and a unit cost. | `products` | `PROD-` | NoxSynergy, Arum Fresh, Biotin, Exosomes |
| **Service** | An act with no stock: a lab panel, a consultation. | `services` | `SRV-` | Consultation, Lab Work, Lab Work - Extended Panel |

## Rules

- A name appears **once per kind**. The same name may exist as a treatment and as a product
  (Lip Filler) only when the clinic sells both; the line knows which one by the kind.
- **Never** move an item between kinds to fix a past sale. The line keeps its kind; if the
  classification was wrong, the item changes for the future by deactivating it and creating the
  right one.
- Cost is an interval (`item_cost_history`); price is an interval (`item_price_history`). The
  catalog column is the price in force today.
- A line's `list_price` is frozen at sale time. Repricing the catalog never touches a sale.

## Where each kind comes from

The owner's master (`docs/catalog.csv`) carries a `Category` column with exactly these values:
`Treatment`, `Package`, `Membership`, `Product`, `Service`. That column is the authority.

## The trap we already hit

The workbook dropdown let the desk invent items on the fly, so the sales file has names that the
master never had (Arum Life, FemGuard, PRP Microneedling). Those are added to the catalog with the
most repeated price in the sales file, and the owner matches them later. Sales are never rewritten
to match the catalog.
