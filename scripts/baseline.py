"""The regression baseline of the historical window.

A committed snapshot of the 432 imported sales: counts, totals and a per-sale salted hash
with no patient data. It is a regression instrument, not proof of correctness: correctness
comes from C08. Regenerate it only before a cutover.

Used by scripts/write_baseline.py and scripts/check_baseline.py, and compared by
scripts/run_checks.py after every batch.
"""
import hashlib
import json
import pathlib
import urllib.request

BASE = pathlib.Path(r"F:\EmpathoAI-projects\legacymd-mission-control")
PATH = BASE / "docs/data/baseline.json"
REF = "konjxlatjymqrzebvtdu"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"
SALT = "legacymd-baseline-v1"
WINDOW_TO = "2026-11-19"
CUTOVER = "2026-11-20"


def token():
    for line in (BASE / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_ACCESS_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("missing SUPABASE_ACCESS_TOKEN")


def query(sql):
    req = urllib.request.Request(
        URL,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def money(value):
    return f"{float(value or 0):.2f}"


def build():
    rows = query(f"""
        select s.id::text as id,
               s.customer_id::text as customer_id,
               s.occurred_on::text as occurred_on,
               s.billed_at::text as billed_at,
               s.is_first_visit,
               s.voided_at::text as voided_at,
               coalesce(sum(i.line_total), 0)::text as total,
               count(i.id)::text as lines
        from public.sales s
        left join public.sale_items i on i.sale_id = s.id
        where s.occurred_on <= date '{WINDOW_TO}'
        group by s.id, s.customer_id, s.occurred_on, s.billed_at, s.is_first_visit, s.voided_at
        order by s.id
    """)

    totals = query(f"""
        select
          (select count(*) from public.sales where occurred_on <= date '{WINDOW_TO}') as sales,
          (select count(*) from public.sale_items i
             join public.sales s on s.id = i.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as sale_items,
          (select count(*) from public.sale_payments p
             join public.sales s on s.id = p.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as sale_payments,
          (select count(*) from public.payment_receipts r
             join public.sale_payments p on p.id = r.sale_payment_id
             join public.sales s on s.id = p.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as payment_receipts,
          (select count(*) from public.sale_refunds f
             join public.sales s on s.id = f.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as sale_refunds,
          (select count(*) from public.adjustments
            where occurred_on <= date '{WINDOW_TO}') as adjustments,
          (select coalesce(sum(i.line_total), 0)::text from public.sale_items i
             join public.sales s on s.id = i.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as revenue,
          (select coalesce(sum(r.amount), 0)::text from public.payment_receipts r
             join public.sale_payments p on p.id = r.sale_payment_id
             join public.sales s on s.id = p.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as collected,
          (select coalesce(sum(f.amount), 0)::text from public.sale_refunds f
             join public.sales s on s.id = f.sale_id
            where s.occurred_on <= date '{WINDOW_TO}') as refunded,
          (select coalesce(sum(a.revenue_delta), 0)::text from public.adjustments a
            where a.occurred_on <= date '{WINDOW_TO}') as adjustment_revenue,
          (select coalesce(sum(a.cash_delta), 0)::text from public.adjustments a
            where a.occurred_on <= date '{WINDOW_TO}') as adjustment_cash
    """)[0]

    # The balance is computed from the window, not from customer_balances, which also
    # carries live sales: a real unpaid plan must not break the historical baseline.
    totals["balance_total"] = money(
        float(totals["revenue"])
        - float(totals["collected"])
        - float(totals["refunded"])
        + float(totals["adjustment_revenue"])
        - float(totals["adjustment_cash"])
    )

    counts = {
        key: int(totals[key])
        for key in (
            "sales",
            "sale_items",
            "sale_payments",
            "payment_receipts",
            "sale_refunds",
            "adjustments",
        )
    }
    totals_out = {
        key: money(totals[key])
        for key in (
            "revenue",
            "collected",
            "refunded",
            "adjustment_revenue",
            "adjustment_cash",
            "balance_total",
        )
    }

    hashes = {}
    for row in rows:
        payload = "|".join(
            [
                SALT,
                row["id"],
                row["customer_id"],
                row["occurred_on"],
                row["billed_at"],
                money(row["total"]),
                row["lines"],
                str(row["is_first_visit"]),
                row["voided_at"] or "",
            ]
        )
        hashes[row["id"]] = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    digest = hashlib.sha256(
        "\n".join(f"{sid}:{h}" for sid, h in sorted(hashes.items())).encode("utf-8")
    ).hexdigest()

    return {
        "salt": SALT,
        "cutover": CUTOVER,
        "window": {"to": WINDOW_TO},
        "counts": counts,
        "totals": totals_out,
        "digest": digest,
        "sales": dict(sorted(hashes.items())),
    }


def load(path=PATH):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def digest_of(sales):
    return hashlib.sha256(
        "\n".join(f"{sid}:{h}" for sid, h in sorted(sales.items())).encode("utf-8")
    ).hexdigest()


def compare(expected, current):
    """Return a list of human-readable differences; empty means the baseline holds."""
    problems = []

    if digest_of(expected["sales"]) != expected["digest"]:
        problems.append("baseline file is inconsistent: the sales map does not match its digest")
    if digest_of(current["sales"]) != current["digest"]:
        problems.append("current snapshot is inconsistent: the sales map does not match its digest")

    for key, value in expected["counts"].items():
        if current["counts"].get(key) != value:
            problems.append(f"count {key}: baseline {value}, now {current['counts'].get(key)}")

    for key, value in expected["totals"].items():
        if current["totals"].get(key) != value:
            problems.append(f"total {key}: baseline {value}, now {current['totals'].get(key)}")

    if expected["digest"] != current["digest"]:
        problems.append("per-sale digest changed")
        base = expected["sales"]
        now = current["sales"]
        missing = sorted(set(base) - set(now))[:10]
        added = sorted(set(now) - set(base))[:10]
        changed = sorted(sid for sid in set(base) & set(now) if base[sid] != now[sid])[:10]
        if missing:
            problems.append(f"missing sales: {', '.join(missing)}")
        if added:
            problems.append(f"new sales in the window: {', '.join(added)}")
        if changed:
            problems.append(f"changed sales: {', '.join(changed)}")

    return problems
