#!/usr/bin/env python3
"""
Build per-state ZIP scrape target lists from data/us_zipcode_population_2020.csv,
ordered **east coast first**, then west across the continental US, then AK/HI/PR.

Output (default --output-dir data/zipcode_targets_by_state):
  me_zipcodes_salon_targets.txt   # lines: "04101 ME"
  ma_zipcodes_salon_targets.txt
  ...
  _state_order_manifest.txt        # two-letter codes in scrape order (one per line)

Each state file lists ZCTAs with population >= --min-population, sorted by population
descending (same as generate_zipcode_target_list.py).

Examples:
  .venv/bin/python3 scripts/generate_zipcode_targets_east_to_west.py
  .venv/bin/python3 scripts/generate_zipcode_targets_east_to_west.py \\
    --output-dir data/zipcode_targets_by_state --min-population 100
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

# Census CSV `state` column values -> USPS two-letter (must match parallel scraper "ZIP ST")
STATE_NAME_TO_CODE: dict[str, str] = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "District of Columbia": "DC",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Puerto Rico": "PR",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
}

# Full state names as in the CSV, Atlantic → Pacific (PR last).
EAST_TO_WEST_STATE_NAMES: tuple[str, ...] = (
    "Maine",
    "New Hampshire",
    "Vermont",
    "Massachusetts",
    "Rhode Island",
    "Connecticut",
    "New York",
    "New Jersey",
    "Pennsylvania",
    "Delaware",
    "Maryland",
    "District of Columbia",
    "Virginia",
    "West Virginia",
    "North Carolina",
    "South Carolina",
    "Georgia",
    "Florida",
    "Alabama",
    "Mississippi",
    "Louisiana",
    "Kentucky",
    "Tennessee",
    "Ohio",
    "Michigan",
    "Indiana",
    "Illinois",
    "Wisconsin",
    "Minnesota",
    "Iowa",
    "Missouri",
    "Arkansas",
    "Oklahoma",
    "Texas",
    "North Dakota",
    "South Dakota",
    "Nebraska",
    "Kansas",
    "Montana",
    "Wyoming",
    "Colorado",
    "New Mexico",
    "Idaho",
    "Utah",
    "Arizona",
    "Washington",
    "Oregon",
    "Nevada",
    "California",
    "Alaska",
    "Hawaii",
    "Puerto Rico",
)


def main() -> int:
    p = argparse.ArgumentParser(
        description="Generate per-state ZIP target files from ZCTA population CSV (east→west order).",
    )
    p.add_argument(
        "--input",
        type=Path,
        default=Path("data/us_zipcode_population_2020.csv"),
        help="Input CSV (zipcode/state/population).",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/zipcode_targets_by_state"),
        help="Directory for <st>_zipcodes_salon_targets.txt and manifest.",
    )
    p.add_argument("--min-population", type=int, default=1)
    p.add_argument(
        "--combined-output",
        type=Path,
        default=None,
        help="Optional single file: all targets in east→west state order (ZIP ST lines).",
    )
    args = p.parse_args()

    in_path = args.input if args.input.is_absolute() else Path.cwd() / args.input
    if not in_path.is_file():
        print(f"Missing input CSV: {in_path}", file=sys.stderr)
        return 1

    by_state: dict[str, list[tuple[int, str]]] = defaultdict(list)
    seen: dict[str, set[str]] = defaultdict(set)

    with in_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            state_name = (row.get("state") or "").strip()
            if not state_name:
                continue
            code = STATE_NAME_TO_CODE.get(state_name)
            if not code:
                print(f"Warning: unknown state name in CSV (skipped): {state_name!r}", file=sys.stderr)
                continue
            zipcode = (row.get("zipcode") or row.get("zcta5") or "").strip()
            if not zipcode or zipcode in seen[code]:
                continue
            try:
                population = int((row.get("population") or "0").strip() or "0")
            except ValueError:
                population = 0
            if population < int(args.min_population):
                continue
            seen[code].add(zipcode)
            by_state[code].append((population, zipcode))

    out_dir = args.output_dir if args.output_dir.is_absolute() else Path.cwd() / args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest_codes: list[str] = []
    combined_lines: list[str] = []

    for state_name in EAST_TO_WEST_STATE_NAMES:
        code = STATE_NAME_TO_CODE.get(state_name)
        if not code:
            continue
        rows = by_state.get(code, [])
        if not rows:
            continue
        rows.sort(key=lambda item: (-item[0], item[1]))
        fname = f"{code.lower()}_zipcodes_salon_targets.txt"
        target_path = out_dir / fname
        body = "\n".join(f"{zc} {code}" for _pop, zc in rows) + "\n"
        target_path.write_text(body, encoding="utf-8")
        manifest_codes.append(code)
        combined_lines.extend(f"{zc} {code}" for _pop, zc in rows)
        print(f"Wrote {len(rows):5d}  {code}  →  {target_path}")

    manifest_path = out_dir / "_state_order_manifest.txt"
    manifest_path.write_text("\n".join(manifest_codes) + "\n", encoding="utf-8")
    print(f"Wrote state order manifest ({len(manifest_codes)} states) → {manifest_path}")

    if args.combined_output:
        co = args.combined_output
        if not co.is_absolute():
            co = Path.cwd() / co
        co.parent.mkdir(parents=True, exist_ok=True)
        co.write_text("\n".join(combined_lines) + "\n", encoding="utf-8")
        print(f"Wrote combined {len(combined_lines)} lines → {co}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
