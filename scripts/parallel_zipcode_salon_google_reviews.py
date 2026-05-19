#!/usr/bin/env python3
"""
Run multiple zipcode-based salon/spa scrape jobs in parallel.

This is an outer dispatcher around `scripts/nj_township_salon_google_reviews.py`.
Each outer worker handles one zipcode target at a time, so you can fan out across
different zipcodes while keeping the existing scraper/checkpoint format.

Target format:
  - one target per line in `--zipcodes-file`
  - or pass targets directly via `--zipcode`
  - each target should be a full search suffix such as:
      04101 ME
      02108 MA
      10001 NY

Examples:
  python3 scripts/parallel_zipcode_salon_google_reviews.py \
    --zipcode "04101 ME" "04102 ME" "04103 ME" \
    --parallel 5 --workers-per-zipcode 1
  # (no --preset / --list-only above → full per-review scrape; add --list-only for leaderboard-only fields)

  # Presets imply --list-only (rating + review count + listing fields; no per-review text).
  python3 scripts/parallel_zipcode_salon_google_reviews.py \
    --zipcodes-file data/me_zipcodes_salon_targets_remaining.txt \
    --preset throughput \
    --output-dir data/me_zipcode_salon_list_reviews \
    --checkpoint-dir data/me_zipcode_list_scrape_checkpoints \
    --include-spa --resume --ingest-at-end ME

  # Massachusetts only (separate run; do not chain with && unless you want MA after ME)
  python3 scripts/parallel_zipcode_salon_google_reviews.py \
    --zipcodes-file data/ma_zipcodes_salon_targets.txt \
    --preset throughput \
    --output-dir data/ma_zipcode_salon_list_reviews \
    --checkpoint-dir data/ma_zipcode_list_scrape_checkpoints \
    --include-spa --resume --ingest-at-end MA

  # Explicit listing/overview scrape (same as preset list-only); use a dir separate from any legacy full-review CSVs
  python3 scripts/parallel_zipcode_salon_google_reviews.py \
    --zipcodes-file data/me_zipcodes_salon_targets.txt \
    --list-only --format csv --include-spa --resume \
    --output-dir data/me_zipcode_salon_list_reviews \
    --checkpoint-dir data/me_zipcode_list_scrape_checkpoints

  # Per-review scrape (omit --preset and --list-only); prefer a dedicated output dir
  python3 scripts/parallel_zipcode_salon_google_reviews.py \
    --zipcodes-file data/me_zipcodes_salon_targets.txt \
    --format both --include-spa --resume \
    --output-dir data/me_zipcode_salon_reviews \
    --checkpoint-dir data/me_zipcode_scrape_checkpoints
"""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPTS_DIR.parent
_WRAPPED_SCRIPT = _SCRIPTS_DIR / "nj_township_salon_google_reviews.py"
_INGEST_SCRIPT = _REPO_ROOT / "pipelines" / "ingest_zipcode_salon_reviews_to_leaderboard.py"


@dataclass
class RunningJob:
    target: str
    started_at: float
    process: subprocess.Popen[str]


def _load_targets(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"Zipcodes file not found: {path}")
    out: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def _build_child_cmd(args: argparse.Namespace, target: str) -> list[str]:
    cmd = [
        sys.executable,
        str(_WRAPPED_SCRIPT),
        "--township",
        target,
        "--workers",
        str(max(1, int(args.workers_per_zipcode))),
        "--target-salons",
        str(max(1, int(args.target_salons))),
        "--max-salons-per-city",
        str(max(0, int(args.max_salons_per_city))),
        "--max-reviews",
        str(max(0, int(args.max_reviews))),
        "--review-scroll-rounds",
        str(max(1, int(args.review_scroll_rounds))),
        "--scroll-pause",
        str(max(0.2, float(args.scroll_pause))),
        "--format",
        args.format,
        "--output-dir",
        str(args.output_dir),
        "--checkpoint-dir",
        str(args.checkpoint_dir),
    ]
    if args.include_spa:
        cmd.append("--include-spa")
    if args.resume:
        cmd.append("--resume")
    if args.no_headless:
        cmd.append("--no-headless")
    if args.diagnose:
        cmd.append("--diagnose")
    if getattr(args, "list_only", False):
        cmd.append("--list-only")
    return cmd


def _terminate_jobs(jobs: list[RunningJob]) -> None:
    for job in jobs:
        try:
            job.process.send_signal(signal.SIGTERM)
        except Exception:
            continue


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Parallel zipcode salon/spa scraper dispatcher.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--zipcodes-file",
        type=Path,
        default=None,
        help="Text file with one zipcode target per line (e.g. '04101 ME').",
    )
    p.add_argument(
        "--zipcode",
        nargs="*",
        default=None,
        help="If set, use these zipcode targets instead of --zipcodes-file.",
    )
    p.add_argument(
        "--parallel",
        type=int,
        default=5,
        help="Outer parallel workers across different zipcodes (default: 5).",
    )
    p.add_argument(
        "--workers-per-zipcode",
        type=int,
        default=1,
        help="Inner scraper workers per zipcode job (default: 1).",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=_REPO_ROOT / "data" / "zipcode_salon_reviews",
        help="Directory for per-zipcode CSV/JSON files.",
    )
    p.add_argument(
        "--checkpoint-dir",
        type=Path,
        default=_REPO_ROOT / "data" / "zipcode_scrape_checkpoints",
        help="Directory for per-zipcode checkpoint JSON files.",
    )
    p.add_argument("--target-salons", type=int, default=400)
    p.add_argument("--max-salons-per-city", type=int, default=0)
    p.add_argument("--max-reviews", type=int, default=120)
    p.add_argument("--review-scroll-rounds", type=int, default=120)
    p.add_argument("--scroll-pause", type=float, default=2.0)
    p.add_argument("--format", choices=["csv", "json", "both"], default="both")
    p.add_argument("--include-spa", action="store_true")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--no-headless", action="store_true")
    p.add_argument("--diagnose", action="store_true")
    p.add_argument(
        "--list-only",
        action="store_true",
        help="Per-ZIP child: only salon listing/overview fields (no review-detail scraping).",
    )
    p.add_argument(
        "--dry-run-list",
        action="store_true",
        help="Print resolved targets and exit without starting scrape jobs.",
    )
    p.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop all workers immediately if any zipcode job exits non-zero.",
    )
    p.add_argument(
        "--ingest-to-leaderboard",
        action="store_true",
        help=(
            "After each successful ZIP scrape, run pipelines/ingest_zipcode_salon_reviews_to_leaderboard.py "
            "for that target (new rows only on salon_ai_leaderboard_latest)."
        ),
    )
    p.add_argument(
        "--ingest-fail-fast",
        action="store_true",
        help="If leaderboard ingest fails, exit non-zero (default: log and continue).",
    )
    p.add_argument(
        "--ingest-chunk-size",
        type=int,
        default=50,
        help="Rows per Supabase insert when using --ingest-to-leaderboard (default: 50).",
    )
    p.add_argument(
        "--zip-population-csv",
        type=Path,
        default=_REPO_ROOT / "data" / "us_zipcode_population_2020.csv",
        help="County lookup CSV for ingest (default: data/us_zipcode_population_2020.csv).",
    )
    p.add_argument(
        "--preset",
        choices=("throughput", "balanced", "coverage"),
        default=None,
        help=(
            "Workflow preset (overrides parallel/workers/format; always enables --list-only, i.e. overview fields "
            "including aggregate rating and review count, not per-review text): "
            "throughput = more ZIPs in parallel, 2 workers/ZIP, high salon cap, csv; "
            "balanced = moderate parallelism; "
            "coverage = fewer concurrent ZIPs, higher salon cap, json+csv."
        ),
    )
    p.add_argument(
        "--poll-interval",
        type=float,
        default=0.5,
        help="Seconds between dispatcher polls while jobs run (default: 0.5).",
    )
    p.add_argument(
        "--ingest-at-end",
        type=str,
        default="",
        metavar="STATE_OR_ALL",
        help=(
            "After all ZIP jobs succeed, batch-ingest leaderboard rows. "
            "Use a two-letter state (e.g. ME) for that state's CSVs only, or ALL for every "
            "state suffix found (salon_reviews_*_<st>.csv). Mutually exclusive with --ingest-to-leaderboard."
        ),
    )
    p.add_argument(
        "--ingest-extra-output-dir",
        type=Path,
        action="append",
        default=None,
        metavar="DIR",
        help=(
            "With --ingest-at-end ALL (or a single state), also scan this directory for salon_reviews_*.csv "
            "(repeatable; e.g. second state's zip scrape folder)."
        ),
    )
    return p


def _apply_preset(args: argparse.Namespace) -> None:
    """Tune parallelism and salon cap. Call after parse_args(). Presets always use list-only (no review-detail scrape)."""
    if not args.preset:
        return
    args.list_only = True
    cpu = max(2, os.cpu_count() or 8)
    if args.preset == "throughput":
        # More ZIPs at once, 2 browsers per ZIP, high salon cap, CSV-only I/O (list-only; max_reviews unused).
        args.parallel = min(8, max(4, cpu // 2))
        args.workers_per_zipcode = 2
        args.target_salons = 800
        args.max_reviews = 80
        args.review_scroll_rounds = 80
        args.scroll_pause = 1.35
        args.format = "csv"
    elif args.preset == "coverage":
        # Fewer concurrent ZIP jobs, higher salon cap, JSON+CSV (list-only rows).
        args.parallel = 3
        args.workers_per_zipcode = 2
        args.target_salons = 1200
        args.max_reviews = 200
        args.review_scroll_rounds = 200
        args.scroll_pause = 2.0
        args.format = "both"
    elif args.preset == "balanced":
        args.parallel = 5
        args.workers_per_zipcode = 1
        args.target_salons = 400
        args.max_reviews = 120
        args.review_scroll_rounds = 120
        args.scroll_pause = 2.0
        args.format = "both"


def _run_zip_ingest(args: argparse.Namespace, target: str) -> int:
    cmd = [
        sys.executable,
        str(_INGEST_SCRIPT),
        "--output-dir",
        str(args.output_dir),
        "--single-target",
        target,
        "--chunk-size",
        str(max(1, min(500, int(args.ingest_chunk_size)))),
    ]
    zcsv = args.zip_population_csv
    path = zcsv if zcsv.is_absolute() else (_REPO_ROOT / zcsv)
    if path.is_file():
        cmd.extend(["--zip-population-csv", str(path)])
    print(f"Ingesting leaderboard for {target!r} …", flush=True)
    proc = subprocess.run(cmd, text=True)
    return int(proc.returncode)


def _run_batch_zip_ingest(args: argparse.Namespace, state: str) -> int:
    cmd = [
        sys.executable,
        str(_INGEST_SCRIPT),
        "--output-dir",
        str(args.output_dir),
    ]
    extras = getattr(args, "ingest_extra_output_dirs", None) or []
    for extra in extras:
        ep = extra if extra.is_absolute() else (_REPO_ROOT / extra)
        cmd.extend(["--output-dir", str(ep)])
    cmd.extend(
        [
            "--all-csvs",
            "--chunk-size",
            str(max(1, min(500, int(args.ingest_chunk_size)))),
        ]
    )
    if state.upper() != "ALL":
        cmd.extend(["--state", state.strip().upper()])
    zcsv = args.zip_population_csv
    path = zcsv if zcsv.is_absolute() else (_REPO_ROOT / zcsv)
    if path.is_file():
        cmd.extend(["--zip-population-csv", str(path)])
    label = "all states (by CSV filename suffix)" if state.upper() == "ALL" else state
    print(f"Batch leaderboard ingest ({label}) …", flush=True)
    proc = subprocess.run(cmd, text=True)
    return int(proc.returncode)


def main() -> None:
    args = build_parser().parse_args()
    _apply_preset(args)

    if args.zipcode is not None and len(args.zipcode) > 0:
        targets = [t.strip() for t in args.zipcode if t.strip()]
    elif args.zipcodes_file is not None:
        path = args.zipcodes_file if args.zipcodes_file.is_absolute() else (_REPO_ROOT / args.zipcodes_file)
        targets = _load_targets(path)
    else:
        print("Provide --zipcode ... or --zipcodes-file PATH", file=sys.stderr)
        sys.exit(1)

    if not targets:
        print("No zipcode targets resolved.", file=sys.stderr)
        sys.exit(1)

    if args.ingest_to_leaderboard and (args.ingest_at_end or "").strip():
        print("Use either --ingest-to-leaderboard or --ingest-at-end STATE, not both.", file=sys.stderr)
        sys.exit(2)

    end_raw = (args.ingest_at_end or "").strip()
    up = end_raw.upper()
    if not up:
        args.ingest_at_end = ""
    elif up == "ALL":
        args.ingest_at_end = "ALL"
    elif len(up) == 2 and up.isalpha():
        args.ingest_at_end = up
    else:
        print("--ingest-at-end: use a two-letter state (e.g. ME) or ALL.", file=sys.stderr)
        sys.exit(2)

    extras_raw = getattr(args, "ingest_extra_output_dir", None)
    if extras_raw is None:
        args.ingest_extra_output_dirs = []
    else:
        args.ingest_extra_output_dirs = list(extras_raw)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    if args.dry_run_list:
        preset_s = f"preset={args.preset!r} | " if args.preset else ""
        print(
            f"{preset_s}list_only={args.list_only} | parallel={args.parallel} | "
            f"workers/ZIP={args.workers_per_zipcode} | target-salons={args.target_salons} | "
            f"max-reviews={args.max_reviews} | review-scroll-rounds={args.review_scroll_rounds} | "
            f"scroll-pause={args.scroll_pause} | format={args.format} | poll-interval={args.poll_interval}",
            flush=True,
        )
        print(f"{len(targets)} zipcode targets (parallel={max(1, int(args.parallel))}):")
        for i, target in enumerate(targets, 1):
            print(f"  {i:3d}. {target}")
        return

    pending = deque(targets)
    running: list[RunningJob] = []
    completed: list[str] = []
    failed: list[tuple[str, int]] = []
    parallel = max(1, int(args.parallel))
    poll_s = max(0.05, float(args.poll_interval))

    while pending or running:
        while pending and len(running) < parallel:
            target = pending.popleft()
            cmd = _build_child_cmd(args, target)
            env = os.environ.copy()
            proc = subprocess.Popen(cmd, text=True, env=env)
            running.append(RunningJob(target=target, started_at=time.time(), process=proc))
            print(
                f"Started [{len(completed) + len(running)}/{len(targets)}] {target} | pid={proc.pid}",
                flush=True,
            )

        next_running: list[RunningJob] = []
        for job in running:
            rc = job.process.poll()
            if rc is None:
                next_running.append(job)
                continue

            elapsed = int(time.time() - job.started_at)
            if rc == 0:
                completed.append(job.target)
                print(f"Finished {job.target} | exit=0 | elapsed_s={elapsed}", flush=True)
                if args.ingest_to_leaderboard:
                    ir = _run_zip_ingest(args, job.target)
                    if ir != 0:
                        msg = f"Leaderboard ingest failed for {job.target} (exit={ir})."
                        if args.ingest_fail_fast:
                            print(msg, file=sys.stderr)
                            _terminate_jobs([j for j in running if j.process.poll() is None])
                            sys.exit(ir)
                        print(msg, flush=True)
            else:
                failed.append((job.target, rc))
                print(f"Failed {job.target} | exit={rc} | elapsed_s={elapsed}", flush=True)
                if args.fail_fast:
                    _terminate_jobs(next_running)
                    print("Fail-fast enabled: terminated remaining workers.", file=sys.stderr)
                    sys.exit(rc)

        running = next_running
        if pending or running:
            time.sleep(poll_s)

    print(
        f"Done. total_targets={len(targets)} completed={len(completed)} failed={len(failed)}",
        flush=True,
    )
    if not failed and args.ingest_at_end:
        ir = _run_batch_zip_ingest(args, args.ingest_at_end)
        if ir != 0:
            print(f"Batch leaderboard ingest failed (exit={ir}).", file=sys.stderr)
            if args.ingest_fail_fast:
                sys.exit(ir)
    if failed:
        for target, rc in failed[:20]:
            print(f"  FAILED {target} -> exit {rc}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        sys.exit(130)
