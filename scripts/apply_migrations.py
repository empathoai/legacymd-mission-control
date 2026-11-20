import json
import pathlib
import subprocess
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

assert token.startswith("sbp_"), "missing token"


def run(sql):
    req = urllib.request.Request(
        URL,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def quote(name):
    return name.replace("'", "''")


# The ledger is created here too so the first run after this change is safe even
# if the migration that introduces it has not been applied yet.
status, body = run(
    "create table if not exists public.schema_migrations ("
    " filename text primary key,"
    " applied_at timestamptz not null default now());"
)
if status >= 300:
    print(f"cannot create the ledger: HTTP {status} {body[:200]}")
    sys.exit(1)

status, body = run("select filename from public.schema_migrations;")
if status >= 300:
    print(f"cannot read the ledger: HTTP {status} {body[:200]}")
    sys.exit(1)
applied = {row["filename"] for row in json.loads(body)}

applied_now = skipped = 0
for path in sorted((BASE / "supabase/migrations").glob("*.sql")):
    if path.name in applied:
        skipped += 1
        continue
    sql = path.read_text(encoding="utf-8-sig").lstrip("\ufeff")
    # One request: the file and its ledger row commit or roll back together.
    status, body = run(
        f"{sql}\ninsert into public.schema_migrations (filename) values ('{quote(path.name)}')"
        " on conflict (filename) do nothing;"
    )
    if status >= 300:
        print(f"FAILED  {path.name}  HTTP {status}  {body[:300]}")
        print(f"stopped: {applied_now} applied, {skipped} already applied")
        sys.exit(1)
    applied_now += 1
    print(f"applied {path.name}")

# `create or replace view` resets the reloptions, so any migration that touches a
# view leaves it SECURITY DEFINER again. The lock-down file is not a one-off: it is
# the invariant, and it runs after every batch whether or not the ledger has it.
INVARIANT = "20261119092800_lock_down_public_access.sql"
invariant_path = BASE / "supabase/migrations" / INVARIANT
status, body = run(invariant_path.read_text(encoding="utf-8-sig").lstrip("\ufeff"))
if status >= 300:
    print(f"FAILED  {INVARIANT} (invariants)  HTTP {status}  {body[:300]}")
    sys.exit(1)
print(f"invariants re-applied: {INVARIANT}")

status, body = run(
    "select"
    " (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace"
    "   where n.nspname='public' and c.relkind='v'"
    "   and not ('security_invoker=true' = any(coalesce(c.reloptions,'{}')))) as definer_views,"
    " (select count(*) from information_schema.role_table_grants"
    "   where table_schema='public' and grantee in ('anon','authenticated')) as public_grants;"
)
if status >= 300:
    print(f"cannot verify invariants: HTTP {status} {body[:200]}")
    sys.exit(1)
check = json.loads(body)[0]
if check["definer_views"] or check["public_grants"]:
    print(
        f"INVARIANT BROKEN: {check['definer_views']} views not security_invoker, "
        f"{check['public_grants']} grants for anon/authenticated"
    )
    sys.exit(1)

print(f"done: {applied_now} applied, {skipped} already applied, 0 failed, invariants ok")

# The agreement checks run last: a batch that breaks one is not accepted.
checks = subprocess.run([sys.executable, str(BASE / "scripts" / "run_checks.py")])
if checks.returncode != 0:
    print("checks failed: the batch is not accepted")
    sys.exit(1)
