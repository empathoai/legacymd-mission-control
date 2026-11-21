"""Freeze the 51 imported appointments into a comparable artifact. Read-only.

Why: the appointments module leaves the system (2026-11-21). Those rows are the only record
of the days a patient came and nothing was sold, and they are the explanation of the 13
patients whose purchase ordinal skips a number. Before anything is dropped, keep them.

The file carries ids and dates, never a patient name, and is ordered deterministically so
a second run produces the same bytes.

Usage: py scripts/export_appointments.py [path.json]
"""

import json
import pathlib
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(__file__).resolve().parent.parent
REF = "konjxlatjymqrzebvtdu"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"


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


rows = query(
    """
    select a.id::text            as appointment_id,
           a.customer_id::text   as customer_id,
           a.scheduled_on::text  as scheduled_on,
           a.scheduled_at::text  as scheduled_at,
           a.status,
           a.expected_category_id::text as expected_category_id,
           a.source_id::text     as source_id,
           a.resolved_on::text   as resolved_on,
           a.resolved_by,
           a.external_ref,
           a.created_by,
           a.created_at::text    as created_at
    from public.appointments a
    order by a.scheduled_on, a.customer_id, a.id
    """
)

payload = {
    "source": "public.appointments, imported 2026-11-20 from the clinic workbook",
    "frozen_on": "2026-11-21",
    "why": "the appointments module leaves the system; these rows explain the visit ordinals that skip a number",
    "rows": rows,
}

out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "docs" / "data" / "appointments-2026-11-21.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
print(f"wrote {len(rows)} appointments to {out}")
