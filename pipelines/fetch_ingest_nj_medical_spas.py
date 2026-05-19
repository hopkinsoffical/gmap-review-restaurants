#!/usr/bin/env python3
"""
Fetch medical spa / med-spa style places across New Jersey via Google Places API
(New) text search, dedupe by place_id, then ingest into public.salon_ai_leaderboard.

Uses Table-A types suitable for Text Search includedType: spa, skin_care_clinic,
wellness_center, medical_clinic — combined with textQuery anchors for medical spas
and plastic / cosmetic surgery clinics.

Reuses HTTP + detail helpers from fetch_ingest_edison_nj_salons.py.

Requires:
  - GOOGLE_PLACES_API_KEY (Places API New enabled)
  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (unless --dry-run)

Usage (repo root):
  python3 pipelines/fetch_ingest_nj_medical_spas.py --dry-run
  python3 pipelines/fetch_ingest_nj_medical_spas.py
  npm run ingest:nj-medical-spas:py
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


def search_specs_medical_spa_for_area(area_label: str) -> list[tuple[str, str]]:
    """includedType + textQuery pairs; area_label biases a metro / hub."""
    a = (area_label or "").strip()
    if not a:
        raise ValueError("area_label is required")
    return [
        ("spa", f"medical spa {a} New Jersey"),
        ("skin_care_clinic", f"medical aesthetics med spa {a} New Jersey"),
        ("wellness_center", f"med spa botox laser {a} New Jersey"),
        ("medical_clinic", f"plastic surgery clinic {a} New Jersey"),
        ("medical_clinic", f"cosmetic surgery plastic surgeon {a} New Jersey"),
    ]


# label = textQuery anchor; lat/lng = locationBias center; county = fallback when API omits it
NJ_MEDICAL_SPA_MARKETS: list[dict[str, Any]] = [
    {"label": "Newark", "lat": 40.7357, "lng": -74.1724, "county": "Essex", "radius_m": 28000.0},
    {"label": "Jersey City", "lat": 40.7178, "lng": -74.0431, "county": "Hudson", "radius_m": 18000.0},
    {"label": "Hackensack", "lat": 40.8859, "lng": -74.0435, "county": "Bergen", "radius_m": 22000.0},
    {"label": "Morristown", "lat": 40.7968, "lng": -74.4815, "county": "Morris", "radius_m": 25000.0},
    {"label": "Edison", "lat": 40.5187, "lng": -74.4121, "county": "Middlesex", "radius_m": 28000.0},
    {"label": "Trenton", "lat": 40.2206, "lng": -74.7560, "county": "Mercer", "radius_m": 25000.0},
    {"label": "Princeton", "lat": 40.3573, "lng": -74.6672, "county": "Mercer", "radius_m": 22000.0},
    {"label": "Cherry Hill", "lat": 39.9334, "lng": -75.0307, "county": "Camden", "radius_m": 28000.0},
    {"label": "Atlantic City", "lat": 39.3643, "lng": -74.4229, "county": "Atlantic", "radius_m": 35000.0},
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
        specs = search_specs_medical_spa_for_area(label)
        print(f"Searching Places (medical spa near {label}, NJ)…", flush=True)
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
    parser = argparse.ArgumentParser(description="Fetch NJ medical spas and ingest to leaderboard.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only write data/nj-medical-spas-fetched.json (no Supabase)",
    )
    parser.add_argument("--chunk-size", type=int, default=100)
    args = parser.parse_args()

    _load_env()
    import os

    api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")

    place_ids, pid_fallbacks = collect_unique_ids_with_fallbacks(api_key, NJ_MEDICAL_SPA_MARKETS)
    print(f"Unique place_id count: {len(place_ids)}", flush=True)

    records = fe.fetch_records_for_place_ids(
        api_key,
        place_ids,
        town_fallback="",
        county_fallback="",
        pid_fallbacks=pid_fallbacks,
    )
    for row in records:
        if not (row.get("town") or "").strip():
            row["town"] = "Unknown"
        if not (row.get("county") or "").strip():
            row["county"] = "Unknown"

    print(f"Fetched {len(records)} place(s).", flush=True)

    out_path = ROOT / "data" / "nj-medical-spas-fetched.json"
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
