#!/usr/bin/env python3
"""
Fast Google Places API salon scraper — replaces Playwright browser scraping.

Uses Places Text Search + Place Details over async HTTP (httpx).
20-50x faster than the Playwright scraper: no browser, no scroll pauses,
concurrent requests with semaphore-controlled rate limiting.

Cost estimate (Google Places API):
  Text Search:  $32 / 1,000 calls  → ~$0.032 per call (20 results each)
  Details:      $17 / 1,000 calls  → ~$0.017 per place (phone, website, etc.)

Examples:
  # Single zip, list-only (no detail calls):
  .venv/bin/python3 scripts/fast_places_scraper.py --zipcode "07001 NJ"

  # Multiple zips, with detail enrichment:
  .venv/bin/python3 scripts/fast_places_scraper.py \\
    --zipcode "07001 NJ" "07002 NJ" "07003 NJ" --details

  # From a file (same format as parallel_zipcode_salon_google_reviews.py):
  .venv/bin/python3 scripts/fast_places_scraper.py \\
    --zipcodes-file data/nj_townships_salon_targets.txt \\
    --output-dir data/fast_places_output \\
    --details --concurrency 10 --resume

  # Dry-run to see what would be queried:
  .venv/bin/python3 scripts/fast_places_scraper.py \\
    --zipcodes-file data/me_zipcodes_salon_targets.txt --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from tqdm import tqdm

_SCRIPTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPTS_DIR.parent

load_dotenv(_REPO_ROOT / ".env.local")
load_dotenv(_REPO_ROOT / ".env")

PLACES_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"

DEFAULT_SEARCH_TERMS = [
    "chinese restaurant",
    "restaurant",
    "chinese food",
    "salon",
    "takeout restaurant",
]

DETAIL_FIELDS = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,business_status,opening_hours,types,url,place_id"


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class SalonRecord:
    place_id: str = ""
    name: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    phone: str = ""
    website: str = ""
    google_url: str = ""
    rating: float = 0.0
    review_count: int = 0
    business_status: str = ""
    types: str = ""
    search_term: str = ""
    source_target: str = ""
    scraped_at: str = ""


# ---------------------------------------------------------------------------
# Places API helpers
# ---------------------------------------------------------------------------

async def _text_search_page(
    client: httpx.AsyncClient,
    query: str,
    api_key: str,
    page_token: str | None = None,
) -> dict[str, Any]:
    params: dict[str, str] = {"query": query, "key": api_key, "type": "beauty_salon|hair_care|spa"}
    if page_token:
        params["pagetoken"] = page_token
    resp = await client.get(PLACES_TEXT_SEARCH, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


async def _place_details(
    client: httpx.AsyncClient,
    place_id: str,
    api_key: str,
) -> dict[str, Any]:
    params = {"place_id": place_id, "fields": DETAIL_FIELDS, "key": api_key}
    resp = await client.get(PLACES_DETAILS, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _parse_city_state_zip(address: str, target: str) -> tuple[str, str, str]:
    """Best-effort extract city, state, zip from formatted_address."""
    zip_m = re.search(r"\b(\d{5})\b", address)
    zip_code = zip_m.group(1) if zip_m else ""
    # "City, ST XXXXX, USA" pattern
    m = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})\s*\d{5}", address)
    if m:
        return m.group(1).strip(), m.group(2).strip(), zip_code
    # Fallback: extract from target string "07001 NJ"
    parts = target.strip().split()
    state = parts[-1].upper() if len(parts) >= 2 else ""
    return "", state, zip_code


# ---------------------------------------------------------------------------
# Core scrape logic per target
# ---------------------------------------------------------------------------

async def scrape_target(
    target: str,
    api_key: str,
    *,
    semaphore: asyncio.Semaphore,
    client: httpx.AsyncClient,
    fetch_details: bool = False,
    max_pages: int = 3,
    search_terms: list[str] | None = None,
    already_seen: set[str],
) -> list[SalonRecord]:
    terms = search_terms or DEFAULT_SEARCH_TERMS
    records: list[SalonRecord] = []
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    for term in terms:
        query = f"{term} {target}"
        page_token: str | None = None

        for page_num in range(max_pages):
            async with semaphore:
                try:
                    if page_token:
                        # Google requires ~2s delay before using a page_token
                        await asyncio.sleep(2.1)
                    data = await _text_search_page(client, query, api_key, page_token)
                except Exception as e:
                    print(f"  [WARN] TextSearch failed ({query} p{page_num}): {e}", flush=True)
                    break

            status = data.get("status", "")
            if status == "ZERO_RESULTS":
                break
            if status not in ("OK", "NEXT_PAGE_TOKEN"):
                if status != "ZERO_RESULTS":
                    print(f"  [WARN] API status={status} for {query}", flush=True)
                break

            for place in data.get("results", []):
                pid = place.get("place_id", "")
                if not pid or pid in already_seen:
                    continue
                already_seen.add(pid)

                addr = place.get("formatted_address", "") or place.get("vicinity", "")
                city, state, zip_code = _parse_city_state_zip(addr, target)

                rec = SalonRecord(
                    place_id=pid,
                    name=place.get("name", ""),
                    address=addr,
                    city=city,
                    state=state,
                    zip_code=zip_code,
                    rating=float(place.get("rating") or 0),
                    review_count=int(place.get("user_ratings_total") or 0),
                    business_status=place.get("business_status", ""),
                    types="|".join(place.get("types", [])),
                    google_url=f"https://www.google.com/maps/place/?q=place_id:{pid}",
                    search_term=term,
                    source_target=target,
                    scraped_at=now,
                )
                records.append(rec)

            page_token = data.get("next_page_token")
            if not page_token:
                break

    if fetch_details and records:
        detail_tasks = []
        for rec in records:
            detail_tasks.append(_enrich_with_details(rec, api_key, semaphore, client))
        await asyncio.gather(*detail_tasks, return_exceptions=True)

    return records


async def _enrich_with_details(
    rec: SalonRecord,
    api_key: str,
    semaphore: asyncio.Semaphore,
    client: httpx.AsyncClient,
) -> None:
    async with semaphore:
        try:
            data = await _place_details(client, rec.place_id, api_key)
        except Exception as e:
            print(f"  [WARN] Details failed ({rec.place_id}): {e}", flush=True)
            return

    result = data.get("result", {})
    if not result:
        return

    rec.phone = result.get("formatted_phone_number", "") or ""
    rec.website = result.get("website", "") or ""
    rec.google_url = result.get("url", rec.google_url) or rec.google_url
    if result.get("rating") is not None:
        rec.rating = float(result["rating"])
    if result.get("user_ratings_total") is not None:
        rec.review_count = int(result["user_ratings_total"])


# ---------------------------------------------------------------------------
# Checkpoint
# ---------------------------------------------------------------------------

def load_checkpoint(path: Path) -> set[str]:
    if path.exists():
        try:
            return set(json.loads(path.read_text())["done"])
        except Exception:
            pass
    return set()


def save_checkpoint(path: Path, done: set[str]) -> None:
    path.write_text(json.dumps({"done": sorted(done)}))


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

FIELDNAMES = list(SalonRecord.__dataclass_fields__.keys())


def write_csv(records: list[SalonRecord], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if path.exists() else "w"
    with open(path, mode, newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if mode == "w":
            w.writeheader()
        w.writerows([asdict(r) for r in records])


def write_json(records: list[SalonRecord], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: list[dict] = []
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except Exception:
            pass
    existing.extend([asdict(r) for r in records])
    path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _load_targets(path: Path) -> list[str]:
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        l = line.strip()
        if l and not l.startswith("#"):
            out.append(l)
    return out


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Fast Google Places API salon scraper (no browser).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--zipcode", nargs="*", default=None, help="One or more targets e.g. '07001 NJ'")
    p.add_argument("--zipcodes-file", type=Path, default=None)
    p.add_argument("--output-dir", type=Path, default=_REPO_ROOT / "data" / "fast_places_restaurants_output")
    p.add_argument("--checkpoint-file", type=Path, default=None,
                   help="JSON checkpoint (default: <output-dir>/checkpoint.json)")
    p.add_argument("--details", action="store_true",
                   help="Fetch Place Details per salon (phone, website). Costs extra API calls.")
    p.add_argument("--concurrency", type=int, default=8,
                   help="Max concurrent API requests (default: 8).")
    p.add_argument("--max-pages", type=int, default=1,
                   help="Pages per search term per target, max 3 (20 results/page). Default 1 to save cost.")
    p.add_argument("--search-terms", nargs="+", default=None,
                   help="Override search terms (default: nail salon, hair salon, beauty salon, salon, day spa).")
    p.add_argument("--budget-usd", type=float, default=200.0,
                   help="Hard cap on estimated API spend in USD (default: $200). Truncates target list to fit.")
    p.add_argument("--resume", action="store_true", help="Skip already-completed targets.")
    p.add_argument("--dry-run", action="store_true", help="Print what would run and exit.")
    p.add_argument("--format", choices=["csv", "json", "both"], default="csv")
    p.add_argument("--api-key", default=None,
                   help="Google Places API key (default: GOOGLE_PLACES_API_KEY env var).")
    p.add_argument("--ingest-at-end", action="store_true",
                   help="After scraping completes, run pipelines/ingest_places_api_to_leaderboard.py automatically.")
    p.add_argument("--ingest-chunk-size", type=int, default=100)
    return p


async def main_async(args: argparse.Namespace) -> None:
    api_key = args.api_key or os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        print("ERROR: Set GOOGLE_PLACES_API_KEY in .env or pass --api-key", file=sys.stderr)
        sys.exit(1)

    if args.zipcode:
        targets = [t.strip() for t in args.zipcode if t.strip()]
    elif args.zipcodes_file:
        path = args.zipcodes_file if args.zipcodes_file.is_absolute() else (_REPO_ROOT / args.zipcodes_file)
        targets = _load_targets(path)
    else:
        print("Provide --zipcode ... or --zipcodes-file PATH", file=sys.stderr)
        sys.exit(1)

    if not targets:
        print("No targets found.", file=sys.stderr)
        sys.exit(1)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.checkpoint_file or (args.output_dir / "checkpoint.json")
    done_targets: set[str] = load_checkpoint(checkpoint_path) if args.resume else set()

    remaining = [t for t in targets if t not in done_targets]

    search_terms = args.search_terms or DEFAULT_SEARCH_TERMS
    cost_per_zip = len(search_terms) * args.max_pages * 0.032
    max_zips_in_budget = int(args.budget_usd / cost_per_zip) if cost_per_zip > 0 else len(remaining)
    if len(remaining) > max_zips_in_budget:
        print(
            f"Budget cap ${args.budget_usd:.0f}: limiting to {max_zips_in_budget} zips "
            f"({len(remaining) - max_zips_in_budget} deferred to next run). "
            f"Cost/zip: ${cost_per_zip:.4f} ({len(search_terms)} terms × {args.max_pages} page(s))",
            flush=True,
        )
        remaining = remaining[:max_zips_in_budget]

    est_calls = len(remaining) * len(search_terms) * args.max_pages
    est_cost = est_calls * 0.032
    print(
        f"Targets: {len(targets)} total | {len(done_targets)} already done | "
        f"{len(remaining)} to scrape | concurrency={args.concurrency} | "
        f"details={'yes' if args.details else 'no'} | "
        f"~{est_calls:,} API calls (~${est_cost:.2f})",
        flush=True,
    )
    print(f"Search terms: {search_terms}", flush=True)

    if args.dry_run:
        for t in remaining[:20]:
            print(f"  {t}")
        if len(remaining) > 20:
            print(f"  ... and {len(remaining)-20} more")
        return

    semaphore = asyncio.Semaphore(args.concurrency)
    already_seen: set[str] = set()
    total_records = 0

    output_csv = args.output_dir / "salons_places_api.csv"
    output_json = args.output_dir / "salons_places_api.json"

    t0 = time.time()
    async with httpx.AsyncClient(http2=True) as client:
        for i, target in enumerate(tqdm(remaining, desc="Targets", unit="zip")):
            try:
                records = await scrape_target(
                    target,
                    api_key,
                    semaphore=semaphore,
                    client=client,
                    fetch_details=args.details,
                    max_pages=args.max_pages,
                    search_terms=search_terms,
                    already_seen=already_seen,
                )
            except Exception as e:
                print(f"\n[ERROR] {target}: {e}", flush=True)
                continue

            if records:
                if args.format in ("csv", "both"):
                    write_csv(records, output_csv)
                if args.format in ("json", "both"):
                    write_json(records, output_json)
                total_records += len(records)

            done_targets.add(target)
            save_checkpoint(checkpoint_path, done_targets)

            elapsed = time.time() - t0
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            tqdm.write(
                f"[{i+1}/{len(remaining)}] {target} → {len(records)} salons | "
                f"total={total_records} | {rate:.1f} targets/s"
            )

    elapsed = time.time() - t0
    print(
        f"\nDone. {len(remaining)} targets | {total_records} unique salons | "
        f"{elapsed:.0f}s ({len(remaining)/elapsed:.1f} targets/s)",
        flush=True,
    )
    if args.format in ("csv", "both"):
        print(f"CSV: {output_csv}", flush=True)
    if args.format in ("json", "both"):
        print(f"JSON: {output_json}", flush=True)

    if getattr(args, "ingest_at_end", False) and args.format in ("csv", "both") and output_csv.is_file():
        import subprocess
        ingest_script = _REPO_ROOT / "pipelines" / "ingest_places_api_to_leaderboard.py"
        print(f"\nStarting leaderboard ingest from {output_csv} …", flush=True)
        result = subprocess.run(
            [sys.executable, str(ingest_script),
             "--input", str(output_csv),
             "--chunk-size", str(getattr(args, "ingest_chunk_size", 100))],
            text=True,
        )
        if result.returncode != 0:
            print("Ingest exited with non-zero status.", file=sys.stderr, flush=True)


def main() -> None:
    args = build_parser().parse_args()
    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        sys.exit(130)


if __name__ == "__main__":
    main()
