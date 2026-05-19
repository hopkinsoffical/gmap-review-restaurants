#!/usr/bin/env python3
"""
Ingest fast_places_scraper.py CSV output into info_gather_google_profiles.

Reads data/fast_places_east_coast/salons_places_api.csv (or any --input CSV),
maps Places API fields to leaderboard schema, skips place_ids already present,
and batch-inserts new rows into public.info_gather_google_profiles.

Usage:
  .venv/bin/python3 pipelines/ingest_places_api_to_leaderboard.py

  # Custom input file:
  .venv/bin/python3 pipelines/ingest_places_api_to_leaderboard.py \\
    --input data/fast_places_east_coast/salons_places_api.csv

  # Dry run (no DB writes):
  .venv/bin/python3 pipelines/ingest_places_api_to_leaderboard.py --dry-run

  # Re-ingest even if place_id already exists:
  .venv/bin/python3 pipelines/ingest_places_api_to_leaderboard.py --re-ingest
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from pathlib import Path
from typing import Any

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv

import ingest_info_gather_google_profiles as ing
import leaderboard_scoring as lbs

load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

DEFAULT_INPUT = ROOT / "data" / "fast_places_east_coast" / "salons_places_api.csv"

# Map Google Places types → human category label
_TYPE_PRIORITY = [
    ("nail_salon",    "Nail Salon"),
    ("hair_care",     "Hair Salon"),
    ("hair_salon",    "Hair Salon"),
    ("beauty_salon",  "Beauty Salon"),
    ("spa",           "Spa"),
    ("massage",       "Massage"),
    ("wellness",      "Wellness"),
    ("gym",           "Gym"),
]

def _category_from_types(types_str: str) -> str:
    t = (types_str or "").lower()
    for key, label in _TYPE_PRIORITY:
        if key in t:
            return label
    return "Salon"


def _parse_csv(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    return rows


def _csv_row_to_source(row: dict[str, Any]) -> dict[str, Any]:
    """Map Places API CSV columns → ingest_info_gather_google_profiles source format."""
    return {
        "name":       row.get("name", "").strip(),
        "address":    row.get("address", "").strip(),
        "state":      row.get("state", "").strip(),
        "town":       row.get("city", "").strip(),
        "zipcode":    row.get("zip_code", "").strip().zfill(5),
        "category":   _category_from_types(row.get("types", "")),
        "rating":     float(row.get("rating") or 0),
        "review_count": int(float(row.get("review_count") or 0)),
        "phone":      row.get("phone", "").strip(),
        "website":    row.get("website", "").strip(),
        "place_id":   row.get("place_id", "").strip(),
        "google_place_id": row.get("place_id", "").strip(),
        "is_listed":  True,
    }


def _fetch_existing_place_ids() -> set[str]:
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    existing: set[str] = set()
    offset, batch = 0, 1000
    while True:
        res = (
            client.table("info_gather_google_profiles_latest")
            .select("place_id")
            .range(offset, offset + batch - 1)
            .execute()
        )
        for r in res.data or []:
            pid = (r.get("place_id") or "").strip()
            if pid:
                existing.add(pid)
        if len(res.data or []) < batch:
            break
        offset += batch
    return existing


def ingest_csv(
    path: Path,
    *,
    chunk_size: int = 100,
    dry_run: bool = False,
    re_ingest: bool = False,
) -> int:
    print(f"Reading {path} …", flush=True)
    raw_rows = _parse_csv(path)
    print(f"  {len(raw_rows)} rows in CSV", flush=True)

    # Deduplicate by place_id within the CSV itself
    seen: set[str] = set()
    source_rows: list[dict[str, Any]] = []
    skipped_no_name = 0
    skipped_no_pid = 0
    for row in raw_rows:
        src = _csv_row_to_source(row)
        if not src["name"]:
            skipped_no_name += 1
            continue
        pid = src["place_id"]
        if not pid:
            skipped_no_pid += 1
            continue
        if pid in seen:
            continue
        seen.add(pid)
        source_rows.append(src)

    print(
        f"  {len(source_rows)} unique rows after dedup "
        f"(skipped {skipped_no_name} nameless, {skipped_no_pid} no place_id)",
        flush=True,
    )

    if not re_ingest:
        print("Fetching existing place_ids from leaderboard …", flush=True)
        existing = _fetch_existing_place_ids()
        before = len(source_rows)
        source_rows = [r for r in source_rows if r["place_id"] not in existing]
        print(f"  {before - len(source_rows)} already in DB, {len(source_rows)} new rows to insert", flush=True)

    if not source_rows:
        print("Nothing to ingest.", flush=True)
        return 0

    if dry_run:
        print(f"[DRY RUN] Would insert {len(source_rows)} rows. Sample:", flush=True)
        for r in source_rows[:3]:
            print(f"  {r['name']} | {r['state']} {r['zipcode']} | rating={r['rating']} reviews={r['review_count']}")
        return 0

    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    # Convert to leaderboard insert format
    insert_rows = []
    for i, src in enumerate(source_rows):
        try:
            insert_rows.append(ing.source_row_to_insert(src, i))
        except Exception as e:
            print(f"  [WARN] Skipping row {i} ({src.get('name')}): {e}", flush=True)

    # Apply global percentile scoring
    lbs.apply_global_percentile_assessment_levels(client, insert_rows)

    # Batch insert
    inserted = 0
    for i in range(0, len(insert_rows), chunk_size):
        chunk = insert_rows[i: i + chunk_size]
        client.table("info_gather_google_profiles").insert(chunk).execute()
        inserted += len(chunk)
        print(f"  Inserted {inserted}/{len(insert_rows)} rows …", flush=True)

    print(f"Done. {inserted} rows ingested into info_gather_google_profiles.", flush=True)

    # Refresh materialized view so API sees new data immediately
    try:
        client.rpc("refresh_leaderboard_latest", {}).execute()
        print("Materialized view refreshed.", flush=True)
    except Exception:
        # Fallback: call REFRESH directly if RPC not available
        try:
            import httpx as _httpx
            sb_url = os.environ["SUPABASE_URL"].rstrip("/")
            sb_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
            _httpx.post(
                f"{sb_url}/rest/v1/rpc/refresh_leaderboard_latest",
                headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"},
                timeout=30,
            )
            print("Materialized view refreshed via RPC.", flush=True)
        except Exception as e2:
            print(f"[WARN] Could not auto-refresh materialized view: {e2}. Run manually: REFRESH MATERIALIZED VIEW CONCURRENTLY public.info_gather_google_profiles_latest;", flush=True)

    return inserted


def main() -> None:
    p = argparse.ArgumentParser(description="Ingest Places API CSV into info_gather_google_profiles.")
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                   help=f"CSV file to ingest (default: {DEFAULT_INPUT})")
    p.add_argument("--chunk-size", type=int, default=100)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--re-ingest", action="store_true",
                   help="Insert even if place_id already exists in leaderboard.")
    args = p.parse_args()

    path = args.input if args.input.is_absolute() else ROOT / args.input
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    ingest_csv(path, chunk_size=args.chunk_size, dry_run=args.dry_run, re_ingest=args.re_ingest)


if __name__ == "__main__":
    main()
