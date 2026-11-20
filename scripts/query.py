import json
import pathlib
import sys
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(r"F:\EmpathoAI-projects\legacymd-mission-control")
REF = "konjxlatjymqrzebvtdu"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"

token = ""
for line in (BASE / ".env.local").read_text(encoding="utf-8").splitlines():
    if line.startswith("SUPABASE_ACCESS_TOKEN="):
        token = line.split("=", 1)[1].strip()

if len(sys.argv) > 1:
    arg = sys.argv[1]
    sql = pathlib.Path(arg[1:]).read_text(encoding="utf-8-sig") if arg.startswith("@") else arg
else:
    sql = sys.stdin.read()
req = urllib.request.Request(
    URL,
    data=json.dumps({"query": sql}).encode("utf-8"),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        print(json.dumps(json.loads(resp.read().decode("utf-8")), indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")
    sys.exit(1)
