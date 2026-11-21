"""Reconcile the owner's catalog sheet against the base, row by row.

Usage: py scripts/reconcile_catalog.py "C:\\path\\catalog.csv"

Reads the sheet's Detail / Cost / Price / Duration / Category columns, pulls every
active item from the base with the price and the cost interval that covers today,
and prints only what differs. Read-only: it never writes to the base.

The sheet is the master. A row whose cost or price reads "Defined in consultation"
(or any non-number) is a decision, not an amount, and is listed as such.
"""

import csv
import difflib
import json
import pathlib
import sys
import unicodedata
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(__file__).resolve().parent.parent
REF = "konjxlatjymqrzebvtdu"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"

KIND_LABEL = {
    "treatment": "Treatment",
    "package": "Package",
    "membership": "Membership",
    "product": "Product",
    "service": "Service",
}


def token():
    for line in (BASE / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_ACCESS_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_ACCESS_TOKEN not found in .env.local")


def query(sql):
    req = urllib.request.Request(
        URL,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


CATALOG_SQL = """
select 'treatment' as kind, code, name, unit_type, price,
       cost_on('treatment', id, current_date) as cost, duration_months
from public.treatments where active
union all
select 'product', code, name, null, price,
       cost_on('product', id, current_date), null
from public.products where active
union all
select 'service', code, name, null, price,
       cost_on('service', id, current_date), null
from public.services where active
"""


def norm(value):
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    out = []
    for ch in text:
        out.append(ch if ch.isalnum() else " ")
    return " ".join("".join(out).split())


def money(value):
    if value is None:
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def parse_amount(raw):
    """Return (Decimal or None, note)."""
    text = (raw or "").strip()
    if not text:
        return None, "blank"
    cleaned = text.replace("$", "").replace(",", "").strip()
    try:
        return Decimal(cleaned).quantize(Decimal("0.01")), ""
    except (InvalidOperation, ValueError):
        return None, text


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: py scripts/reconcile_catalog.py "<path to catalog csv>"')
    sheet_path = pathlib.Path(sys.argv[1])
    rows = list(csv.DictReader(sheet_path.read_text(encoding="utf-8-sig").splitlines()))

    catalog = query(CATALOG_SQL)
    by_name = {}
    for item in catalog:
        kind = item["kind"]
        if kind == "treatment":
            label = KIND_LABEL.get(item["unit_type"] or "treatment", "Treatment")
        else:
            label = KIND_LABEL[kind]
        by_name.setdefault(norm(item["name"]), []).append({**item, "label": label})

    # The sheet repeats a few names; keep one row per name, and note the repeats.
    sheet = {}
    repeats = []
    for row in rows:
        name = (row.get("Detail") or "").strip()
        if not name:
            continue
        key = norm(name)
        if key in sheet:
            repeats.append(name)
            continue
        sheet[key] = row

    matched_keys = set()

    def expected_label(category):
        return {
            "treatment": "Treatment",
            "package": "Package",
            "membership": "Membership",
            "product": "Product",
            "service": "Service",
        }.get(norm(category), "")

    print("# Reconciliation: owner's sheet vs the base")
    print()
    print(f"sheet rows: {len(rows)}  unique names: {len(sheet)}  repeated names: {len(repeats)}")
    print(f"base active items: {len(catalog)}")
    print()

    price_diff, cost_diff, no_amount, unmatched, kind_diff = [], [], [], [], []
    agree = 0

    for key, row in sheet.items():
        name = row["Detail"].strip()
        sheet_price, price_note = parse_amount(row.get("Price"))
        sheet_cost, cost_note = parse_amount(row.get("Cost"))
        category = (row.get("Category") or "").strip()
        duration = (row.get("Duracion/meses") or "").strip()
        wanted = expected_label(category)

        hits = by_name.get(key, [])
        if not hits:
            pool = list(by_name.keys())
            guesses = difflib.get_close_matches(key, pool, n=2, cutoff=0.72)
            unmatched.append((name, category, [by_name[g][0]["name"] for g in guesses]))
            continue
        matched_keys.add(key)
        item = next((h for h in hits if h["label"] == wanted), hits[0])
        if item["label"] != wanted and wanted:
            kind_diff.append((name, ", ".join(sorted({h["label"] for h in hits})), category))
        if sheet_price is None or sheet_cost is None:
            no_amount.append((name, item["name"], item["label"], cost_note or price_note))
            continue

        db_price = money(item["price"])
        db_cost = money(item["cost"])
        row_differs = False
        if db_price != sheet_price:
            price_diff.append((name, item["label"], item["code"], db_price, sheet_price))
            row_differs = True
        if db_cost != sheet_cost:
            cost_diff.append((name, item["label"], item["code"], db_cost, sheet_cost))
            row_differs = True
        if not row_differs:
            agree += 1

    def table(title, header, lines):
        print(f"## {title}: {len(lines)}")
        if not lines:
            print()
            return
        print()
        print("| " + " | ".join(header) + " |")
        print("|" + "|".join("---" for _ in header) + "|")
        for line in lines:
            print("| " + " | ".join("" if v is None else str(v) for v in line) + " |")
        print()

    table(
        "Price differs (base -> sheet)",
        ["Detail", "Kind", "Code", "Base price", "Sheet price"],
        price_diff,
    )
    table(
        "Cost differs (base -> sheet)",
        ["Detail", "Kind", "Code", "Base cost", "Sheet cost"],
        cost_diff,
    )
    table(
        "Sheet says 'defined in consultation' (no amount)",
        ["Detail", "Base item", "Kind", "Sheet says"],
        no_amount,
    )
    table(
        "Kind disagrees (sheet vs base)",
        ["Detail", "Stored as", "Sheet says"],
        kind_diff,
    )

    print(f"## In the sheet, no item in the base: {len(unmatched)}")
    if unmatched:
        print()
        print("| Detail | Category | Closest base name |")
        print("|---|---|---|")
        for name, category, guesses in unmatched:
            print(f"| {name} | {category} | {', '.join(guesses) or '—'} |")
    print()

    in_base_not_sheet = []
    for key, hits in by_name.items():
        if key in matched_keys:
            continue
        item = hits[0]
        in_base_not_sheet.append((item["name"], item["label"], item["code"], money(item["price"]), money(item["cost"])))

    print(f"## In the base, not in the sheet: {len(in_base_not_sheet)}")
    if in_base_not_sheet:
        print()
        print("| Name | Kind | Code | Price | Cost |")
        print("|---|---|---|---|---|")
        for line in sorted(in_base_not_sheet, key=lambda r: (r[1], r[0])):
            print("| " + " | ".join("" if v is None else str(v) for v in line) + " |")
    print()

    print(f"## Agree on price and cost: {agree} of {len(sheet)} sheet names")
    if repeats:
        print(f"## Repeated names folded into one: {', '.join(sorted(set(repeats)))}")


if __name__ == "__main__":
    main()
