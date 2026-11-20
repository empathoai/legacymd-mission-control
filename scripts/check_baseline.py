"""Compare the live database with the committed baseline.

Exit 0 when the counts, totals and per-sale digests match; 1 otherwise, with the differences.
"""
import sys

import baseline

expected = baseline.load()
current = baseline.build()
problems = baseline.compare(expected, current)

if problems:
    print("baseline broken:")
    for problem in problems:
        print(f"  - {problem}")
    sys.exit(1)

print(f"baseline holds: {expected['counts']['sales']} sales, "
      f"revenue {expected['totals']['revenue']}, "
      f"collected {expected['totals']['collected']}, "
      f"digest {expected['digest'][:12]}")
