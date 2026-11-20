"""Run the agreement checks and their negative controls.

Each file in supabase/checks/*.sql must return zero rows.
Each file in supabase/checks/controls/*.sql must return at least one row: it breaks the
rule inside a transaction, proves the check notices, and rolls back.

Exit code 0 only when every check is clean and every control fired.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(r"F:\EmpathoAI-projects\legacymd-mission-control")
REF = "konjxlatjymqrzebvtdu"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"

token = ""
for line in (BASE / ".env.local").read_text(encoding="utf-8").splitlines():
    if line.startswith("SUPABASE_ACCESS_TOKEN="):
        token = line.split("=", 1)[1].strip()

if not token.startswith("sbp_"):
    print("missing SUPABASE_ACCESS_TOKEN")
    sys.exit(1)


def run(sql):
    req = urllib.request.Request(
        URL,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def rows_of(body):
    data = json.loads(body or "[]")
    return data if isinstance(data, list) else [data]


failed = 0

for path in sorted((BASE / "supabase/checks").glob("*.sql")):
    status, body = run(path.read_text(encoding="utf-8-sig").lstrip("\ufeff"))
    if status >= 300:
        print(f"check {path.stem}: ERROR {status} {body[:200]}")
        failed += 1
        continue
    rows = rows_of(body)
    if rows:
        print(f"check {path.stem}: {len(rows)} row(s) violate the rule")
        print(json.dumps(rows[:3], ensure_ascii=False)[:600])
        failed += 1
    else:
        print(f"check {path.stem}: 0 rows")

for path in sorted((BASE / "supabase/checks/controls").glob("*.sql")):
    status, body = run(path.read_text(encoding="utf-8-sig").lstrip("\ufeff"))
    if status >= 300:
        print(f"control {path.stem}: ERROR {status} {body[:200]}")
        failed += 1
        continue
    rows = rows_of(body)
    if rows:
        print(f"control {path.stem}: fired ({len(rows)} row(s))")
    else:
        print(f"control {path.stem}: DID NOT FIRE")
        failed += 1

try:
    import baseline
    problems = baseline.compare(baseline.load(), baseline.build())
except FileNotFoundError:
    print("baseline: file missing")
    failed += 1
else:
    if problems:
        print("baseline: broken")
        for problem in problems:
            print(f"  - {problem}")
        failed += 1
    else:
        print(f"baseline: holds ({baseline.load()['counts']['sales']} sales)")

print(f"checks: {failed} failed")
sys.exit(1 if failed else 0)
