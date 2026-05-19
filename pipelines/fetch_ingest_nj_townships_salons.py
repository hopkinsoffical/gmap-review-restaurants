#!/usr/bin/env python3
"""
Fetch salon-like places for selected New Jersey municipalities via Google Places
API (New) text search, dedupe by place_id, then ingest into public.salon_ai_leaderboard.

Reuses helpers from fetch_ingest_edison_nj_salons.py.

Requires:
  - GOOGLE_PLACES_API_KEY (Places API New enabled)
  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (unless --dry-run)

Usage (repo root):
  python3 pipelines/fetch_ingest_nj_townships_salons.py
  python3 pipelines/fetch_ingest_nj_townships_salons.py --dry-run
  npm run ingest:nj-townships:py
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv  # noqa: E402

import fetch_ingest_edison_nj_salons as fe  # noqa: E402

# label = textQuery anchor; lat/lng = searchText locationBias center; county = fallback when API omits it
NJ_MARKETS: list[dict[str, Any]] = [
    {"label": "Jersey City", "lat": 40.7178, "lng": -74.0431, "county": "Hudson", "radius_m": 8500.0},
    {"label": "Hoboken", "lat": 40.7439, "lng": -74.0324, "county": "Hudson", "radius_m": 6000.0},
    {"label": "Fort Lee", "lat": 40.8509, "lng": -73.9701, "county": "Bergen", "radius_m": 7000.0},
    {"label": "Edgewater", "lat": 40.8275, "lng": -73.9757, "county": "Bergen", "radius_m": 6000.0},
    {"label": "Westfield", "lat": 40.6587, "lng": -74.3474, "county": "Union", "radius_m": 9000.0},
    {"label": "Summit", "lat": 40.7151, "lng": -74.3646, "county": "Union", "radius_m": 9000.0},
    {"label": "Millburn", "lat": 40.7212, "lng": -74.3025, "county": "Essex", "radius_m": 9000.0},
    {"label": "Ridgewood", "lat": 40.9793, "lng": -74.1165, "county": "Bergen", "radius_m": 9000.0},
    {"label": "Montclair", "lat": 40.8259, "lng": -74.2090, "county": "Essex", "radius_m": 9000.0},
    {"label": "Princeton", "lat": 40.3573, "lng": -74.6672, "county": "Mercer", "radius_m": 12000.0},
]


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def collect_unique_ids_with_fallbacks(
    api_key: str,
    markets: list[dict[str, Any]],
) -> tuple[list[str], dict[str, tuple[str, str]]]:
    """First-seen market wins town/county fallbacks for each place_id."""
    ordered: list[str] = []
    seen: set[str] = set()
    pid_fallbacks: dict[str, tuple[str, str]] = {}

    for m in markets:
        label = str(m["label"]).strip()
        lat = float(m["lat"])
        lng = float(m["lng"])
        county = str(m.get("county") or "").strip()
        rm = m.get("radius_m")
        specs = fe.search_specs_for_town(label)
        print(f"Searching Places ({label}, NJ)…", flush=True)
        ids = fe.collect_place_ids(
            api_key,
            center_lat=lat,
            center_lng=lng,
            radius_m=float(rm) if rm is not None else None,
            search_specs=specs,
        )
        print(f"  {len(ids)} id(s) this area (running unique…)", flush=True)
        for pid in ids:
            if pid in seen:
                continue
            seen.add(pid)
            ordered.append(pid)
            pid_fallbacks[pid] = (label, county)
        time.sleep(0.5)

    return ordered, pid_fallbacks


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch NJ township salons and ingest to leaderboard.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only write data/nj-townships-salons-fetched.json (no Supabase)",
    )
    parser.add_argument("--chunk-size", type=int, default=100)
    args = parser.parse_args()

    _load_env()
    import os

    api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")

    place_ids, pid_fallbacks = collect_unique_ids_with_fallbacks(api_key, NJ_MARKETS)
    print(f"Unique place_id count: {len(place_ids)}", flush=True)

    records = fe.fetch_records_for_place_ids(
        api_key,
        place_ids,
        town_fallback="",
        county_fallback="",
        pid_fallbacks=pid_fallbacks,
    )
    # Empty string fallbacks only apply if pid missing from map (should not happen)
    for row in records:
        if not (row.get("town") or "").strip():
            row["town"] = "Unknown"
        if not (row.get("county") or "").strip():
            row["county"] = "Unknown"

    print(f"Fetched {len(records)} place(s).", flush=True)

    out_path = ROOT / "data" / "nj-townships-salons-fetched.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}", flush=True)

    if args.dry_run:
        print("Dry run: skip Supabase ingest.")
        return

    import ingest_salon_ai_leaderboard as ing  # noqa: WPS433

    ing._load_env()
    chunk = max(1, min(500, int(args.chunk_size)))
    n, slugs = ing.ingest(records, chunk_size=chunk)
    print(f"Ingested {n} row(s). Slugs (first 10): {', '.join(slugs[:10])}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
