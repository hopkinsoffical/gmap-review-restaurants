#!/usr/bin/env python3
"""
Massachusetts ZIP codes: salon/spa listing scrape only (no per-review text), then ingest
new rows into public.salon_ai_leaderboard.

After regenerating population CSV, rebuild targets:
  npm run generate:zipcode-targets:east-west:py

Uses Edison --list-only. Writes under data/ma_zipcode_salon_list_reviews/ — separate from
any Maine work (data/me_zipcode_* ) and from full MA review scrapes (data/ma_zipcode_salon_reviews/).

Default zip list: data/zipcode_targets_by_state/ma_zipcodes_salon_targets.txt when that directory
exists (from generate_zipcode_targets_east_to_west.py), otherwise data/ma_zipcodes_salon_targets.txt.

Prerequisites: .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; salon_ai_leaderboard migrations.

Usage (from repo root):
  python3 pipelines/fetch_ingest_ma_zipcode_salon_list.py
  python3 pipelines/fetch_ingest_ma_zipcode_salon_list.py --dry-run
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MA zip salon/spa list scrape (list-only) + salon_ai_leaderboard ingest.",
    )
    parser.add_argument(
        "--zipcodes-file",
        type=Path,
        default=None,
        help="One 'ZIP ST' per line. Default: data/zipcode_targets_by_state/ma_zipcodes_salon_targets.txt "
        "if present (from generate_zipcode_targets_east_to_west.py), else data/ma_zipcodes_salon_targets.txt.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "data" / "ma_zipcode_salon_list_reviews",
        help="Per-ZIP CSV output directory (default: data/ma_zipcode_salon_list_reviews).",
    )
    parser.add_argument(
        "--checkpoint-dir",
        type=Path,
        default=ROOT / "data" / "ma_zipcode_list_scrape_checkpoints",
        help="Checkpoint directory (default: data/ma_zipcode_list_scrape_checkpoints).",
    )
    parser.add_argument("--parallel", type=int, default=8)
    parser.add_argument("--workers-per-zipcode", type=int, default=2)
    parser.add_argument("--target-salons", type=int, default=600)
    parser.add_argument("--scroll-pause", type=float, default=1.0)
    parser.add_argument("--chunk-size", type=int, default=80)
    parser.add_argument(
        "--zip-population-csv",
        type=Path,
        default=ROOT / "data" / "us_zipcode_population_2020.csv",
    )
    parser.add_argument("--no-headless", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Print commands only.")
    args = parser.parse_args()

    zf = args.zipcodes_file
    if zf is None:
        preferred = ROOT / "data" / "zipcode_targets_by_state" / "ma_zipcodes_salon_targets.txt"
        fallback = ROOT / "data" / "ma_zipcodes_salon_targets.txt"
        zf = preferred if preferred.is_file() else fallback
    else:
        zf = zf if zf.is_absolute() else ROOT / zf
    if not zf.is_file():
        print(f"Zipcodes file not found: {zf}", file=sys.stderr)
        sys.exit(1)

    out_dir = args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir
    ckpt_dir = args.checkpoint_dir if args.checkpoint_dir.is_absolute() else ROOT / args.checkpoint_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    parallel_py = ROOT / "scripts" / "parallel_zipcode_salon_google_reviews.py"
    ingest_py = ROOT / "pipelines" / "ingest_zipcode_salon_reviews_to_leaderboard.py"

    scrape_cmd = [
        sys.executable,
        str(parallel_py),
        "--zipcodes-file",
        str(zf),
        "--parallel",
        str(max(1, int(args.parallel))),
        "--workers-per-zipcode",
        str(max(1, int(args.workers_per_zipcode))),
        "--target-salons",
        str(max(1, int(args.target_salons))),
        "--max-salons-per-city",
        "0",
        "--max-reviews",
        "0",
        "--review-scroll-rounds",
        "1",
        "--scroll-pause",
        str(max(0.2, float(args.scroll_pause))),
        "--format",
        "csv",
        "--output-dir",
        str(out_dir),
        "--checkpoint-dir",
        str(ckpt_dir),
        "--include-spa",
        "--resume",
        "--list-only",
    ]
    if args.no_headless:
        scrape_cmd.append("--no-headless")

    zcsv = args.zip_population_csv
    zpath = zcsv if zcsv.is_absolute() else ROOT / zcsv

    ingest_cmd = [
        sys.executable,
        str(ingest_py),
        "--output-dir",
        str(out_dir),
        "--state",
        "MA",
        "--all-csvs",
        "--chunk-size",
        str(max(1, min(500, int(args.chunk_size)))),
    ]
    if zpath.is_file():
        ingest_cmd.extend(["--zip-population-csv", str(zpath)])

    print("1) List-only scrape (MA):\n   " + " ".join(scrape_cmd), flush=True)
    print("2) Leaderboard ingest (MA):\n   " + " ".join(ingest_cmd), flush=True)
    if args.dry_run:
        return

    r1 = subprocess.run(scrape_cmd, check=False)
    if r1.returncode != 0:
        print(f"Scrape step failed (exit {r1.returncode}).", file=sys.stderr)
        sys.exit(r1.returncode)

    r2 = subprocess.run(ingest_cmd, check=False)
    if r2.returncode != 0:
        print(f"Ingest step failed (exit {r2.returncode}).", file=sys.stderr)
        sys.exit(r2.returncode)
    print("Done: MA list scrape + leaderboard ingest.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
