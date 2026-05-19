#!/usr/bin/env python3
"""
Count Twilio line types for NJ salons only, using:
  - data/leaderboard_phone_sms.csv (lookup_line_type from Twilio)
  - salon_ai_leaderboard_latest (state = NJ) for membership

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage:
  python3 scripts/count_nj_mobile_from_phone_csv.py
  python3 scripts/count_nj_mobile_from_phone_csv.py --csv data/leaderboard_phone_sms.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from collections import Counter
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]

from dotenv import load_dotenv  # noqa: E402


def _load_env() -> None:
    load_dotenv(_ROOT / ".env.local")
    load_dotenv(_ROOT / ".env")


def _fetch_slugs_by_state(client: object, state_value: str) -> set[str]:
    out: set[str] = set()
    page = 0
    page_size = 1000
    while True:
        r = (
            client.table("salon_ai_leaderboard_latest")
            .select("slug")
            .eq("state", state_value)
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        batch = r.data or []
        for row in batch:
            s = str(row.get("slug") or "").strip()
            if s:
                out.add(s)
        if len(batch) < page_size:
            break
        page += 1
    return out


def _fetch_nj_slugs(client: object, state_eq: str, include_new_jersey_name: bool) -> set[str]:
    out = _fetch_slugs_by_state(client, state_eq)
    if include_new_jersey_name:
        out |= _fetch_slugs_by_state(client, "New Jersey")
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--csv", default="data/leaderboard_phone_sms.csv", help="Phone lookup export CSV")
    p.add_argument("--state", default="NJ")
    p.add_argument("--include-full-state-name", action="store_true")
    args = p.parse_args(argv)

    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        print("Install: pip install -r pipelines/requirements.txt", file=sys.stderr)
        return 1

    _load_env()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    csv_path = Path(args.csv)
    if not csv_path.is_file():
        print(f"Missing CSV: {csv_path}", file=sys.stderr)
        return 1

    client = create_client(url, key)
    nj_slugs = _fetch_nj_slugs(
        client,
        args.state.strip() or "NJ",
        bool(args.include_full_state_name),
    )

    type_counts: Counter[str] = Counter()
    nj_rows = 0
    nj_no_csv = 0

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            slug = str(row.get("slug") or "").strip()
            if slug not in nj_slugs:
                continue
            nj_rows += 1
            lt = str(row.get("lookup_line_type") or "").strip().lower()
            raw = str(row.get("twilio_line_type_raw") or "").strip().lower()
            valid = str(row.get("lookup_valid") or "").strip().lower()

            if not lt and valid != "true":
                bucket = "invalid_or_unverified"
            elif lt in ("mobile", "wireless"):
                bucket = "mobile_or_wireless"
            elif lt == "landline":
                bucket = "landline"
            elif lt == "voip":
                bucket = "voip"
            elif not lt:
                bucket = "unknown_empty_type"
            else:
                bucket = f"other:{lt}"

            type_counts[bucket] += 1

    # Slugs in NJ but missing from CSV (new salons since export)
    known_csv_slugs = set()
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        known_csv_slugs = {str(r.get("slug") or "").strip() for r in reader}

    for s in nj_slugs:
        if s not in known_csv_slugs:
            nj_no_csv += 1

    distinct_nj = len(nj_slugs)
    mobile_n = type_counts.get("mobile_or_wireless", 0)

    print("--- NJ salons (salon_ai_leaderboard_latest) ---")
    print(f"Distinct NJ slugs (state filter): {distinct_nj}")
    print(f"Rows in CSV matched to NJ (may repeat slug if CSV has dupes): {nj_rows}")
    print(f"NJ slugs not present in CSV (need refresh export): {nj_no_csv}")
    print()
    print("--- Twilio lookup_line_type (NJ rows in leaderboard_phone_sms.csv) ---")
    for k in sorted(type_counts.keys()):
        print(f"  {k}: {type_counts[k]}")
    print()
    print(
        f"Mobile / wireless (SMS-friendly): {mobile_n} rows "
        f"({100.0 * mobile_n / nj_rows:.1f}% of NJ rows in CSV)" if nj_rows else "No NJ rows in CSV."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
