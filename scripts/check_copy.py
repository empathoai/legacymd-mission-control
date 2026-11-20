"""Fails when any interface file uses a gendered pronoun.

The clinic's copy is neutral: no she, no he, no her, no his. The rule is easy to
break while writing a placeholder, so it is checked instead of remembered.
"""
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(r"F:\EmpathoAI-projects\legacymd-mission-control")
WEB = BASE / "web"
PATTERN = re.compile(r"\b(she|her|hers|his|him|he|herself|himself)\b", re.IGNORECASE)
SKIP = {"node_modules", ".next", "dist"}

hits = []
for path in WEB.rglob("*"):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    if SKIP.intersection(path.parts):
        continue
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if PATTERN.search(line):
            hits.append(f"{path.relative_to(BASE)}:{number}: {line.strip()[:140]}")

if hits:
    print(f"gendered copy in {len(hits)} line(s):")
    for hit in hits:
        print(f"  {hit}")
    sys.exit(1)

print("copy: neutral")
