#!/usr/bin/env python3
"""
Crawler-only salon/spa ingestion for Massachusetts (U.S. state).

Flow:
1) Playwright scraper (scripts/nj_township_salon_google_reviews.py) per locality.
2) Aggregate per-review rows into unique salon/spa rows.
3) Ingest into public.salon_ai_leaderboard.
4) Optionally run Instagram enrichment for rows with state=MA.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv  # noqa: E402

import ingest_salon_ai_leaderboard as ing  # noqa: E402

STATE_CODE = "MA"
DEFAULT_TARGETS_PATH = ROOT / "data" / "ma_townships_salon_targets.txt"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "ma_township_salon_reviews"
DEFAULT_CHECKPOINT_DIR = ROOT / "data" / "ma_township_scrape_checkpoints"
DEFAULT_SALON_JSON = ROOT / "data" / "ma-townships-salons-fetched.json"
INSTAGRAM_RE = re.compile(
    r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?(?:\?|#|$)",
    re.IGNORECASE,
)


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def _stable_slug(name: str, stable_key: str) -> str:
    h = hashlib.sha256((stable_key or name).encode("utf-8")).hexdigest()[:10]
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:28] or "salon"
    cand = f"{base}-{h}"
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", cand):
        return cand
    return f"salon-{h}"


def _extract_place_id_from_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    m = re.search(r"!1s([^:!]+):0x", u)
    if m:
        return m.group(1)
    m2 = re.search(r"/place/([^/?]+)", u)
    if m2:
        return m2.group(1)
    return ""


def _normalize_instagram(url: str) -> tuple[str, str] | None:
    m = INSTAGRAM_RE.search(url or "")
    if not m:
        return None
    handle = (m.group(1) or "").strip()
    if not handle:
        return None
    return f"https://www.instagram.com/{handle}/", handle


def _parse_targets(path: Path) -> tuple[list[str], dict[str, str]]:
    if not path.is_file():
        raise FileNotFoundError(f"Targets file not found: {path}")
    places: list[str] = []
    county_by_place: dict[str, str] = {}
    for idx, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 1:
            label = parts[0]
            county = parts[3] if len(parts) >= 4 else ""
            place = f"{label} {STATE_CODE}"
            places.append(place)
            county_by_place[place.lower()] = county
            continue
        raise ValueError(f"Invalid targets line {idx}: {line}")
    if not places:
        raise ValueError(f"No valid targets in {path}")
    return places, county_by_place


def _run_scraper(
    places: list[str],
    output_dir: Path,
    checkpoint_dir: Path,
    *,
    workers: int,
    target_salons: int,
    max_reviews: int,
    scroll_pause: float,
    no_headless: bool,
    resume: bool,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "nj_township_salon_google_reviews.py"),
        "--township",
        *places,
        "--workers",
        str(workers),
        "--target-salons",
        str(target_salons),
        "--max-reviews",
        str(max_reviews),
        "--scroll-pause",
        str(scroll_pause),
        "--include-spa",
        "--format",
        "both",
        "--output-dir",
        str(output_dir),
        "--checkpoint-dir",
        str(checkpoint_dir),
    ]
    if no_headless:
        cmd.append("--no-headless")
    if resume:
        cmd.append("--resume")
    print(f"Running crawler: {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, check=True)


def _read_reviews_csv(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({k: (v or "").strip() for k, v in r.items()})
    return rows


def _normalize_town(raw_search_city: str) -> str:
    t = re.sub(
        r"^(nail salon|hair salon|beauty salon|day spa|spa|salon)\s+",
        "",
        raw_search_city.strip(),
        flags=re.I,
    )
    t = re.sub(rf"\s+{STATE_CODE}$", "", t, flags=re.I).strip()
    return t or "Unknown"


def _category_from_search_city(raw_search_city: str) -> str:
    s = (raw_search_city or "").lower()
    if "day spa" in s:
        return "day spa"
    if re.search(r"\bspa\b", s):
        return "spa"
    if "nail salon" in s:
        return "nail salon"
    if "hair salon" in s:
        return "hair salon"
    if "beauty salon" in s:
        return "beauty salon"
    return "salon"


def aggregate_ma_salon_rows(
    output_dir: Path,
    county_by_place: dict[str, str],
) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for csv_path in sorted(output_dir.glob("salon_reviews_*.csv")):
        for r in _read_reviews_csv(csv_path):
            google_url = r.get("salon_google_url", "")
            if not google_url:
                continue
            key = google_url
            town = _normalize_town(r.get("search_city", ""))
            place_key = f"{town} {STATE_CODE}".lower()
            county = county_by_place.get(place_key, "Unknown")
            rating_val = None
            try:
                rating_val = float(r["rating"]) if r.get("rating") else None
            except ValueError:
                rating_val = None
            instagram = _normalize_instagram(r.get("salon_instagram", ""))
            item = grouped.setdefault(
                key,
                {
                    "name": r.get("salon_name", ""),
                    "address": r.get("salon_address", ""),
                    "phone": r.get("salon_phone", ""),
                    "website": r.get("salon_website", ""),
                    "town": town,
                    "county": county,
                    "state": STATE_CODE,
                    "category": _category_from_search_city(r.get("search_city", "")),
                    "place_id": _extract_place_id_from_url(google_url),
                    "google_place_id": _extract_place_id_from_url(google_url),
                    "instagram_url": instagram[0] if instagram else "",
                    "instagram_handle": instagram[1] if instagram else "",
                    "instagram_source": "maps_overview" if instagram else "",
                    "reviews": [],
                    "_rating_sum": 0.0,
                    "_rating_n": 0,
                    "_review_count": 0,
                },
            )
            item["_review_count"] += 1
            if rating_val is not None:
                item["_rating_sum"] += rating_val
                item["_rating_n"] += 1
                item["reviews"].append(
                    {"rating": rating_val, "publishTime": r.get("published_at", "") or None},
                )
            if not item.get("website"):
                item["website"] = r.get("salon_website", "")
            if not item.get("phone"):
                item["phone"] = r.get("salon_phone", "")
            if instagram and not item.get("instagram_url"):
                item["instagram_url"] = instagram[0]
                item["instagram_handle"] = instagram[1]
                item["instagram_source"] = "maps_overview"

    out: list[dict[str, Any]] = []
    for google_url, item in grouped.items():
        n = int(item.pop("_rating_n"))
        s = float(item.pop("_rating_sum"))
        rc = int(item.pop("_review_count"))
        rating = (s / n) if n > 0 else 0.0
        stable_key = item.get("place_id") or google_url
        item["slug"] = _stable_slug(item.get("name", ""), stable_key)
        item["rating"] = round(rating, 2)
        item["review_count"] = rc
        item["is_listed"] = True
        item["zipcode"] = ""
        out.append(item)
    return out


def maybe_run_instagram_enrichment(sleep_s: float) -> None:
    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "leaderboard_instagram_enrichment.py"),
        "--state",
        STATE_CODE,
        "--sleep",
        f"{sleep_s}",
    ]
    print(f"Running Instagram enrichment: {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Massachusetts salons/spas: scrape localities in targets file -> leaderboard.",
    )
    parser.add_argument("--targets-file", type=Path, default=DEFAULT_TARGETS_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--checkpoint-dir", type=Path, default=DEFAULT_CHECKPOINT_DIR)
    parser.add_argument("--salon-json-out", type=Path, default=DEFAULT_SALON_JSON)
    parser.add_argument("--max-targets", type=int, default=0)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--target-salons", type=int, default=400)
    parser.add_argument("--max-reviews", type=int, default=120)
    parser.add_argument("--scroll-pause", type=float, default=2.0)
    parser.add_argument("--no-headless", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Scrape + aggregate only (no leaderboard ingest)")
    parser.add_argument("--chunk-size", type=int, default=100)
    parser.add_argument("--enrich-instagram", action="store_true")
    parser.add_argument("--instagram-sleep", type=float, default=0.2)
    args = parser.parse_args()

    _load_env()
    ing._load_env()

    targets_path = args.targets_file if args.targets_file.is_absolute() else ROOT / args.targets_file
    places, county_by_place = _parse_targets(targets_path)
    if args.max_targets and args.max_targets > 0:
        places = places[: int(args.max_targets)]
    print(
        f"Loaded {len(places)} Massachusetts locality target(s) (state {STATE_CODE}) from {targets_path}",
        flush=True,
    )

    _run_scraper(
        places,
        args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir,
        args.checkpoint_dir if args.checkpoint_dir.is_absolute() else ROOT / args.checkpoint_dir,
        workers=max(1, int(args.workers)),
        target_salons=max(1, int(args.target_salons)),
        max_reviews=max(0, int(args.max_reviews)),
        scroll_pause=max(0.2, float(args.scroll_pause)),
        no_headless=bool(args.no_headless),
        resume=bool(args.resume),
    )

    records = aggregate_ma_salon_rows(
        args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir,
        county_by_place,
    )
    print(f"Aggregated {len(records)} unique {STATE_CODE} salons/spas.", flush=True)

    out_path = args.salon_json_out if args.salon_json_out.is_absolute() else ROOT / args.salon_json_out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}", flush=True)

    if args.dry_run:
        print("Dry run: skip Supabase ingest.")
        return

    chunk = max(1, min(500, int(args.chunk_size)))
    n, slugs = ing.ingest(records, chunk_size=chunk)
    print(f"Ingested {n} row(s). Slugs (first 10): {', '.join(slugs[:10])}", flush=True)

    if args.enrich_instagram:
        maybe_run_instagram_enrichment(max(0.0, float(args.instagram_sleep)))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
