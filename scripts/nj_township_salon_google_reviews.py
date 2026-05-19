#!/usr/bin/env python3
"""
Run the Edison-area Google Maps salon scraper sequentially for many NJ places.

Each township/borough gets the same four search phrases as the Edison defaults
(salon / nail / hair / beauty). Runs one place at a time so checkpoints and CSVs
stay isolated per place.

Requires the same stack as edison_nj_salon_google_reviews.py (Playwright, etc.).

Examples:
  python3 scripts/nj_township_salon_google_reviews.py \\
    --townships-file data/nj_townships_salon_targets.txt --workers 2

  python3 scripts/nj_township_salon_google_reviews.py \\
    --township "Princeton NJ" "Hopewell NJ" --target-salons 800

  # Scrape then upsert each CSV into public.edison_nj_salon_google_reviews
  python3 scripts/nj_township_salon_google_reviews.py --ingest-each
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path
from typing import List

_SCRIPTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPTS_DIR.parent

if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

import edison_nj_salon_google_reviews as edison  # noqa: E402


def _slug(place: str) -> str:
    s = re.sub(r"[^\w\s-]", "", place)
    s = re.sub(r"[-\s]+", "_", s.strip()).lower()
    return (s[:180] or "place").strip("_")


def _load_township_lines(path: Path) -> List[str]:
    if not path.is_file():
        raise FileNotFoundError(f"Townships file not found: {path}")
    out: List[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def _search_terms_for_place(place: str, *, include_spa: bool = False) -> List[str]:
    p = place.strip()
    terms: List[str] = [
        f"salon {p}",
        f"nail salon {p}",
        f"hair salon {p}",
        f"beauty salon {p}",
    ]
    if include_spa:
        terms.extend([f"day spa {p}", f"spa {p}"])
    return terms


def _should_skip(place: str, exclude_lower: List[str]) -> bool:
    pl = place.lower()
    return any(ex in pl for ex in exclude_lower)


def _build_edison_args(
    edison_parser: argparse.ArgumentParser,
    *,
    search_terms: List[str],
    output: str,
    checkpoint: str,
    workers: int,
    target_salons: int,
    max_salons_per_city: int,
    max_reviews: int,
    review_scroll_rounds: int,
    scroll_pause: float,
    fmt: str,
    resume: bool,
    no_headless: bool,
    diagnose: bool,
    ingest: bool,
    list_only: bool = False,
) -> argparse.Namespace:
    argv: List[str] = [
        "--workers",
        str(workers),
        "--target-salons",
        str(target_salons),
        "--max-salons-per-city",
        str(max_salons_per_city),
        "--max-reviews",
        str(max_reviews),
        "--review-scroll-rounds",
        str(review_scroll_rounds),
        "--scroll-pause",
        str(scroll_pause),
        "--output",
        output,
        "--checkpoint",
        checkpoint,
        "--format",
        fmt,
        "--search-terms",
        *search_terms,
    ]
    if resume:
        argv.append("--resume")
    if no_headless:
        argv.append("--no-headless")
    if diagnose:
        argv.append("--diagnose")
    if ingest:
        argv.append("--ingest")
    if list_only:
        argv.append("--list-only")
    return edison_parser.parse_args(argv)


def build_wrapper_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Sequential NJ township/borough salon review scraper (wraps Edison script).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--townships-file",
        type=Path,
        default=_REPO_ROOT / "data/nj_townships_salon_targets.txt",
        help="Text file: one place suffix per line (e.g. 'Woodbridge NJ')",
    )
    p.add_argument(
        "--township",
        nargs="*",
        default=None,
        help="If set, use these places instead of --townships-file",
    )
    p.add_argument(
        "--exclude",
        nargs="*",
        default=[],
        help="Skip places whose name contains any of these substrings (case-insensitive)",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=_REPO_ROOT / "data" / "nj_township_salon_reviews",
        help="Directory for per-place CSV/JSON bases",
    )
    p.add_argument(
        "--checkpoint-dir",
        type=Path,
        default=_REPO_ROOT / "data" / "nj_township_scrape_checkpoints",
        help="Directory for per-place checkpoint JSON",
    )
    p.add_argument(
        "--ingest-each",
        action="store_true",
        help="After each place, upsert that place's CSV into Supabase (same table as Edison)",
    )
    p.add_argument(
        "--dry-run-list",
        action="store_true",
        help="Print places that would be scraped (after excludes) and exit",
    )
    p.add_argument(
        "--include-spa",
        action="store_true",
        help="Add 'day spa' and 'spa' search queries for each place (6 queries instead of 4)",
    )
    p.add_argument("--workers", type=int, default=2)
    p.add_argument("--target-salons", type=int, default=400)
    p.add_argument("--max-salons-per-city", type=int, default=0)
    p.add_argument("--max-reviews", type=int, default=0)
    p.add_argument("--review-scroll-rounds", type=int, default=120)
    p.add_argument("--scroll-pause", type=float, default=2.0)
    p.add_argument("--format", choices=["csv", "json", "both"], default="both")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--no-headless", action="store_true")
    p.add_argument("--diagnose", action="store_true")
    p.add_argument(
        "--list-only",
        action="store_true",
        help="Maps listing/overview only (no per-review scraping); passes through to Edison.",
    )
    p.add_argument(
        "--ingest-batch-size",
        type=int,
        default=400,
        help="Used with --ingest-each",
    )
    return p


def main() -> None:
    wargs = build_wrapper_parser().parse_args()
    edison_parser = edison.build_parser()

    if wargs.township is not None and len(wargs.township) > 0:
        places = [p.strip() for p in wargs.township if p.strip()]
    else:
        places = _load_township_lines(wargs.townships_file)

    exclude_lower = [e.strip().lower() for e in wargs.exclude if e.strip()]
    places = [pl for pl in places if not _should_skip(pl, exclude_lower)]

    if not places:
        print("No places to scrape after filters.", file=sys.stderr)
        sys.exit(1)

    if wargs.dry_run_list:
        print(f"{len(places)} places:")
        for i, pl in enumerate(places, 1):
            print(f"  {i:3d}. {pl}")
        return

    wargs.output_dir.mkdir(parents=True, exist_ok=True)
    wargs.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    for idx, place in enumerate(places, 1):
        slug = _slug(place)
        out_base = wargs.output_dir / f"salon_reviews_{slug}"
        ckpt = wargs.checkpoint_dir / f"checkpoint_{slug}.json"
        terms = _search_terms_for_place(place, include_spa=bool(wargs.include_spa))

        edison.log.info(
            "=== [%d/%d] %s | output=%s | checkpoint=%s ===",
            idx,
            len(places),
            place,
            out_base,
            ckpt,
        )

        ns = _build_edison_args(
            edison_parser,
            search_terms=terms,
            output=str(out_base),
            checkpoint=str(ckpt),
            workers=wargs.workers,
            target_salons=wargs.target_salons,
            max_salons_per_city=wargs.max_salons_per_city,
            max_reviews=wargs.max_reviews,
            review_scroll_rounds=wargs.review_scroll_rounds,
            scroll_pause=wargs.scroll_pause,
            fmt=wargs.format,
            resume=wargs.resume,
            no_headless=wargs.no_headless,
            diagnose=wargs.diagnose,
            ingest=False,
            list_only=bool(wargs.list_only),
        )

        try:
            asyncio.run(edison.run_scraper(ns))
        except KeyboardInterrupt:
            edison.log.info("Interrupted at place: %s", place)
            sys.exit(130)

        if wargs.ingest_each:
            csv_path = Path(str(out_base) + ".csv")
            try:
                n = edison.ingest_reviews_csv(
                    csv_path, batch_size=wargs.ingest_batch_size
                )
                edison.log.info("Ingest [%s]: %d rows from %s", place, n, csv_path)
            except Exception as exc:
                edison.log.error("Ingest failed for %s: %s", place, exc)
                sys.exit(1)

    edison.log.info("All %d places finished.", len(places))


if __name__ == "__main__":
    main()
