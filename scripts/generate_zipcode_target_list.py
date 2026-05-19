#!/usr/bin/env python3
"""
Generate zipcode scrape target files from `data/us_zipcode_population_2020.csv`.

Output format is one target per line:
  <zipcode> <state_code>

For **all states** ordered east coast → west, use instead:
  scripts/generate_zipcode_targets_east_to_west.py

Examples:
  .venv/bin/python3 scripts/generate_zipcode_target_list.py \
    --state-name "Maine" \
    --state-code ME \
    --output data/me_zipcodes_salon_targets.txt
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser(description="Generate zipcode target list for parallel salon scraping.")
    p.add_argument(
        "--input",
        type=Path,
        default=Path("data/us_zipcode_population_2020.csv"),
        help="Input CSV with zipcode/state/population columns.",
    )
    p.add_argument("--state-name", required=True, help="Full state name as it appears in the CSV, e.g. Maine")
    p.add_argument("--state-code", required=True, help="Two-letter state code, e.g. ME")
    p.add_argument("--output", type=Path, required=True, help="Output target file path")
    p.add_argument("--min-population", type=int, default=1, help="Only include zipcodes with population >= this")
    p.add_argument("--limit", type=int, default=0, help="Optional maximum number of zipcodes to keep")
    args = p.parse_args()

    in_path = args.input
    if not in_path.is_absolute():
        in_path = Path.cwd() / in_path
    if not in_path.is_file():
        print(f"Missing input CSV: {in_path}", file=sys.stderr)
        return 1

    rows: list[tuple[int, str]] = []
    seen: set[str] = set()
    wanted_state = args.state_name.strip()
    state_code = args.state_code.strip().upper()

    with in_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row.get("state") or "").strip() != wanted_state:
                continue
            zipcode = (row.get("zipcode") or row.get("zcta5") or "").strip()
            if not zipcode or zipcode in seen:
                continue
            try:
                population = int((row.get("population") or "0").strip() or "0")
            except ValueError:
                population = 0
            if population < int(args.min_population):
                continue
            seen.add(zipcode)
            rows.append((population, zipcode))

    if not rows:
        print(f"No zipcodes found for state={wanted_state!r}", file=sys.stderr)
        return 1

    rows.sort(key=lambda item: (-item[0], item[1]))
    if args.limit and args.limit > 0:
        rows = rows[: int(args.limit)]

    out_path = args.output
    if not out_path.is_absolute():
        out_path = Path.cwd() / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        "\n".join(f"{zipcode} {state_code}" for _pop, zipcode in rows) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(rows)} zipcode targets to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
