"""Write the historical baseline.

Refuses to overwrite an existing baseline: regenerating it after a change would erase the
evidence that something moved. Use --force only before a cutover.
"""
import argparse
import json
import sys

import baseline

parser = argparse.ArgumentParser()
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

if baseline.PATH.exists() and not args.force:
    print(f"{baseline.PATH} exists. Regenerating it erases the evidence; pass --force only "
          "before a cutover.")
    sys.exit(1)

data = baseline.build()
baseline.PATH.parent.mkdir(parents=True, exist_ok=True)
baseline.PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

print(f"baseline written: {baseline.PATH}")
print(f"  sales {data['counts']['sales']}, revenue {data['totals']['revenue']}, "
      f"collected {data['totals']['collected']}, digest {data['digest'][:12]}")
