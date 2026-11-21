"""Per-patient detail for the three weight-loss items. Read-only against the base.

Usage: py scripts/export_sessions.py [path.csv]

Writes a CSV (default under docs/, which is gitignored because it carries patient names)
and prints the aggregate to the console. Nothing here decides a session count: the base
knows visits and money, the clinic owns how many sessions an item includes.
"""

import csv
import json
import pathlib
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(__file__).resolve().parent.parent
REF = "konjxlatjymqrzebvtdu"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"
ITEMS = [
    "Weight Loss Packages w/ Tirzepatide",
    "Weight Loss Package w/ Semaglutide",
    "Male Optimization - Timmix",
]


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


names = "', '".join(ITEMS)
SQL = f"""
select t.name as item,
       c.full_name as patient,
       count(si.id) as charges,
       count(distinct s.occurred_on) as visit_days,
       round(sum(si.line_total), 2) as paid,
       round(min(si.line_total), 2) as smallest_charge,
       round(max(si.line_total), 2) as largest_charge,
       min(s.occurred_on)::text as first_on,
       max(s.occurred_on)::text as last_on,
       (max(s.occurred_on) - min(s.occurred_on)) as days_span
from public.sale_items si
join public.sales s on s.id = si.sale_id
join public.treatments t on t.id = si.treatment_id
join public.customers c on c.id = s.customer_id
where t.name in ('{names}')
group by 1, 2
order by 1, charges desc, paid desc
"""

rows = query(SQL)
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "docs" / "sessions-detail-2026-11-21.csv"
with out.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"wrote {len(rows)} rows to {out}")
for item in ITEMS:
    group = [r for r in rows if r["item"] == item]
    if not group:
        continue
    charges = [int(r["charges"]) for r in group]
    days = sum(int(r["visit_days"]) for r in group)
    paid = sum(float(r["paid"]) for r in group)
    buckets = {}
    for count in charges:
        buckets[count] = buckets.get(count, 0) + 1
    print()
    print(f"## {item}")
    print(
        f"patients {len(group)}  charges {sum(charges)}  visit days {days}  "
        f"paid {paid:,.2f}  avg/charge {paid/sum(charges):,.2f}"
    )
    print("  charges -> patients: " + ", ".join(f"{k}={v}" for k, v in sorted(buckets.items())))
    print(f"  single-charge patients: {sum(1 for v in charges if v == 1)}")
    print(f"  four or more: {sum(1 for v in charges if v >= 4)}")
    doubles = [r for r in group if int(r["charges"]) > int(r["visit_days"])]
    if doubles:
        print(f"  bought twice in one day: {', '.join(r['patient'] for r in doubles)}")
