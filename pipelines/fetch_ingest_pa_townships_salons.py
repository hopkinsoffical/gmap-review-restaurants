#!/usr/bin/env python3
"""
Fetch salon/spa places for Pennsylvania townships via Google Places API (New),
dedupe by place_id, ingest into public.salon_ai_leaderboard, then optionally
enrich Instagram for the PA rows.

Targets are read from data/pa_townships_salon_targets.txt with one row per line:
  Township Label|latitude|longitude|County Name|radius_meters

Requires:
  - GOOGLE_PLACES_API_KEY
  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (unless --dry-run)

Usage (repo root):
  python3 pipelines/fetch_ingest_pa_townships_salons.py --dry-run
  python3 pipelines/fetch_ingest_pa_townships_salons.py
  python3 pipelines/fetch_ingest_pa_townships_salons.py --enrich-instagram
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv  # noqa: E402

import fetch_ingest_edison_nj_salons as fe  # noqa: E402

DEFAULT_TARGETS_PATH = ROOT / "data" / "pa_townships_salon_targets.txt"


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def search_specs_for_pa_town(town_label: str) -> list[tuple[str, str]]:
    t = (town_label or "").strip()
    if not t:
        raise ValueError("town_label is required")
    return [
        ("hair_care", f"hair salon {t} Pennsylvania"),
        ("beauty_salon", f"beauty salon {t} Pennsylvania"),
        ("nail_salon", f"nail salon {t} Pennsylvania"),
        ("spa", f"day spa {t} Pennsylvania"),
        ("barber_shop", f"barber shop {t} Pennsylvania"),
    ]


def load_pa_markets(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"Targets file not found: {path}")
    markets: list[dict[str, Any]] = []
    for idx, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 5:
            raise ValueError(f"Invalid targets format at line {idx}: expected 5 pipe-delimited fields")
        label, lat_s, lng_s, county, radius_s = parts
        markets.append(
            {
                "label": label,
                "lat": float(lat_s),
                "lng": float(lng_s),
                "county": county,
                "radius_m": float(radius_s),
            },
        )
    if not markets:
        raise ValueError(f"No targets found in {path}")
    return markets


def collect_unique_ids_with_fallbacks(
    api_key: str,
    markets: list[dict[str, Any]],
) -> tuple[list[str], dict[str, tuple[str, str]]]:
    ordered: list[str] = []
    seen: set[str] = set()
    pid_fallbacks: dict[str, tuple[str, str]] = {}

    for i, m in enumerate(markets, 1):
        label = str(m["label"]).strip()
        lat = float(m["lat"])
        lng = float(m["lng"])
        county = str(m.get("county") or "").strip()
        rm = m.get("radius_m")
        specs = search_specs_for_pa_town(label)
        print(f"[{i}/{len(markets)}] Searching Places ({label}, PA)…", flush=True)
        ids = fe.collect_place_ids(
            api_key,
            center_lat=lat,
            center_lng=lng,
            radius_m=float(rm) if rm is not None else None,
            search_specs=specs,
        )
        print(f"  {len(ids)} id(s) this township (running unique…)", flush=True)
        for pid in ids:
            if pid in seen:
                continue
            seen.add(pid)
            ordered.append(pid)
            pid_fallbacks[pid] = (label, county)
        time.sleep(0.5)

    return ordered, pid_fallbacks


def maybe_run_instagram_enrichment(sleep_s: float) -> None:
    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "leaderboard_instagram_enrichment.py"),
        "--state",
        "PA",
        "--sleep",
        f"{sleep_s}",
    ]
    print(f"Running Instagram enrichment: {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch PA township salons/spas and ingest to leaderboard.")
    parser.add_argument(
        "--targets-file",
        type=Path,
        default=DEFAULT_TARGETS_PATH,
        help="Pipe-delimited targets file (default: data/pa_townships_salon_targets.txt)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only write data/pa-townships-salons-fetched.json (no Supabase)",
    )
    parser.add_argument(
        "--max-targets",
        type=int,
        default=0,
        help="Only process first N township targets (0 = all)",
    )
    parser.add_argument("--chunk-size", type=int, default=100)
    parser.add_argument(
        "--enrich-instagram",
        action="store_true",
        help="Run scripts/leaderboard_instagram_enrichment.py for state=PA after ingest",
    )
    parser.add_argument(
        "--instagram-sleep",
        type=float,
        default=0.15,
        help="Sleep seconds passed to Instagram enrichment script",
    )
    args = parser.parse_args()

    _load_env()
    import os

    api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")

    targets_path = args.targets_file if args.targets_file.is_absolute() else ROOT / args.targets_file
    markets = load_pa_markets(targets_path)
    if args.max_targets and args.max_targets > 0:
        markets = markets[: int(args.max_targets)]
    print(f"Loaded {len(markets)} PA township target(s) from {targets_path}", flush=True)

    place_ids, pid_fallbacks = collect_unique_ids_with_fallbacks(api_key, markets)
    print(f"Unique place_id count: {len(place_ids)}", flush=True)

    records = fe.fetch_records_for_place_ids(
        api_key,
        place_ids,
        town_fallback="",
        county_fallback="",
        state_fallback="PA",
        pid_fallbacks=pid_fallbacks,
    )
    for row in records:
        if not (row.get("town") or "").strip():
            row["town"] = "Unknown"
        if not (row.get("county") or "").strip():
            row["county"] = "Unknown"

    print(f"Fetched {len(records)} place(s).", flush=True)

    out_path = ROOT / "data" / "pa-townships-salons-fetched.json"
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

    if args.enrich_instagram:
        maybe_run_instagram_enrichment(max(0.0, float(args.instagram_sleep)))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
