#!/usr/bin/env python3
"""
Ingest Google restaurant profiles into public.restr_ai_leaderboard (append-only history).

Reads from info_gather_google_profiles (latest listed rows) and scores with
restr_leaderboard_scoring (Google Visibility customer-acquisition model).

Prerequisites:
  - Supabase: sql/034_restr_ai_leaderboard.sql
  - Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (repo root .env / .env.local)

Usage (from repo root):
  python3 pipelines/ingest_restr_ai_leaderboard.py [--limit N] [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import requests

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
if str(_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

from restr_leaderboard_scoring import (  # noqa: E402
    assign_assessment_levels_by_ai_score_percentile,
    calc_restr_ai_score,
    freshness_heuristic,
    restr_dimension_scores_from_signals,
    sentiment_from_review_histogram,
)


def supabase_config() -> tuple[str, str, Dict[str, str]]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return url, key, headers


def make_slug(title: str, place_id: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (title or "restaurant").lower()).strip("-")[:40]
    suffix = hashlib.md5(place_id.encode()).hexdigest()[:10]
    candidate = f"{base}-{suffix}"
    if re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", candidate):
        return candidate
    return f"restaurant-{suffix}"


def fetch_all(
    supabase_url: str,
    headers: Dict[str, str],
    table: str,
    params: Dict[str, str] | None = None,
    page_size: int = 500,
    max_rows: int = 0,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        if max_rows and len(rows) >= max_rows:
            rows = rows[:max_rows]
            break
        resp = requests.get(
            f"{supabase_url}/rest/v1/{table}",
            headers={**headers, "Range-Unit": "items", "Range": f"{offset}-{offset + page_size - 1}"},
            params=params or {"select": "*", "order": "updated_at.desc"},
            timeout=60,
        )
        if not resp.ok:
            detail = resp.text[:400]
            raise RuntimeError(f"Supabase read failed for {table} ({resp.status_code}): {detail}")
        batch = resp.json()
        if not batch:
            break
        rows.extend(batch)
        if max_rows and len(rows) >= max_rows:
            rows = rows[:max_rows]
            break
        if len(batch) < page_size:
            break
        offset += page_size
        time.sleep(0.05)
    return rows


# Outscraper-style Google profile source tables (newest first).
# 1) info_gather_google_profiles_dedup — view: one row per place_id (latest scrape)
# 2) info_gather_google_profiles_latest — legacy materialized view (sql/030)
# 3) info_gather_google_profiles — raw table (has duplicates from re-scrapes)
SOURCE_TABLE_CANDIDATES = (
    "info_gather_google_profiles_dedup",
    "info_gather_google_profiles_latest",
    "info_gather_google_profiles",
)


# Minimal column set for the leaderboard — avoids pulling heavy Outscraper nested JSON
# (raw, additional_info, popular_times_histogram) that bloats PostgREST responses.
SOURCE_COLUMNS = (
    "place_id,title,address,state,city,postal_code,"
    "category_name,rating,reviews_count,"
    "phone,website,reviews_distribution,best_menu_url,"
    "opening_hours,image_url,categories,price,"
    "updated_at,permanently_closed,temporarily_closed"
)


def fetch_source_rows(
    supabase_url: str,
    headers: Dict[str, str],
    max_rows: int = 0,
) -> tuple[List[Dict[str, Any]], str]:
    last_error: Exception | None = None
    for table in SOURCE_TABLE_CANDIDATES:
        try:
            rows = fetch_all(
                supabase_url,
                headers,
                table,
                params={"select": SOURCE_COLUMNS, "order": "updated_at.desc"},
                max_rows=max_rows,
            )
            print(f"Read {len(rows)} rows from {table}")
            return rows, table
        except RuntimeError as err:
            last_error = err
            print(f"Skip {table}: {err}", file=sys.stderr)
    raise RuntimeError(
        "Could not read any source table. Expected one of: "
        + ", ".join(SOURCE_TABLE_CANDIDATES)
        + (f". Last error: {last_error}" if last_error else "")
    )


def sentiment_fallback_from_rating(rating: float) -> float:
    r = float(rating or 0)
    if r >= 4.8:
        return 0.95
    if r >= 4.6:
        return 0.9
    if r >= 4.4:
        return 0.85
    if r >= 4.1:
        return 0.8
    if r >= 3.8:
        return 0.72
    return 0.66


# Outscraper info_gather_google_profiles uses Google-style column names; map to the
# normalized leaderboard field names. Keep both styles for forward-compat.
SOURCE_FIELD_ALIASES = {
    "name": ("name", "title"),
    "address": ("address",),
    "state": ("state",),
    "town": ("town", "city"),
    "zipcode": ("zipcode", "postal_code"),
    "category": ("category", "category_name"),
    "review_count": ("review_count", "reviews_count"),
    "place_id": ("place_id",),
    "google_place_id": ("google_place_id",),
    "phone": ("phone",),
    "website": ("website",),
    "reviews_distribution": ("reviews_distribution",),
    "reviews": ("reviews",),
    "best_menu_url": ("best_menu_url", "menu_url"),
    "opening_hours": ("opening_hours",),
    "image_url": ("image_url",),
    "categories": ("categories",),
    "price": ("price",),
    "delivery": ("delivery",),
    "takeout": ("takeout",),
    "dine_in": ("dine_in",),
    "reservable": ("reservable",),
    "profile_updated_at": ("profile_updated_at", "updated_at"),
}


def _field(rec: Dict[str, Any], key: str) -> Any:
    for alias in SOURCE_FIELD_ALIASES.get(key, (key,)):
        if alias in rec and rec[alias] is not None:
            return rec[alias]
    return None


def _is_listed(rec: Dict[str, Any]) -> bool:
    # Outscraper tables don't have is_listed; exclude permanently_closed / temporarily_closed.
    if rec.get("is_listed") is False:
        return False
    if rec.get("permanently_closed") is True or rec.get("temporarily_closed") is True:
        return False
    return True


def build_row(rec: Dict[str, Any]) -> Dict[str, Any] | None:
    place_id = str(_field(rec, "place_id") or _field(rec, "google_place_id") or "").strip()
    name = str(_field(rec, "name") or "").strip()
    slug = str(rec.get("slug") or "").strip().lower()
    if not slug and place_id:
        slug = make_slug(name or "restaurant", place_id)
    if not slug:
        return None

    rating = float(_field(rec, "rating") or 0)
    review_count = max(0, int(_field(rec, "review_count") or 0))
    hist = _field(rec, "reviews_distribution") or {}
    if hist:
        sentiment_p = sentiment_from_review_histogram(hist, review_count)
    else:
        sentiment_p = sentiment_fallback_from_rating(rating)
    freshness_f = freshness_heuristic(review_count, _field(rec, "reviews") or [])

    dim_signals = {
        "rating": rating,
        "reviewCount": review_count,
        "sentimentP": sentiment_p,
        "freshnessF": freshness_f,
        "phone": _field(rec, "phone"),
        "website": _field(rec, "website"),
        "address": _field(rec, "address"),
        "placeId": place_id,
        "menuUrl": _field(rec, "best_menu_url"),
        "openingHours": _field(rec, "opening_hours"),
        "imageUrl": _field(rec, "image_url"),
        "categories": _field(rec, "categories"),
        "price": _field(rec, "price"),
        "delivery": _field(rec, "delivery"),
        "takeout": _field(rec, "takeout"),
        "dineIn": _field(rec, "dine_in"),
        "reservable": _field(rec, "reservable"),
    }
    dims = restr_dimension_scores_from_signals(dim_signals)
    ai_score = calc_restr_ai_score(
        rating,
        review_count,
        sentiment_p,
        freshness_f,
        dims["dim_local_seo_score"],
        dims["dim_conversion_score"],
    )

    town = str(_field(rec, "town") or "").strip()
    state = str(_field(rec, "state") or "").strip()
    return {
        "slug": slug,
        "name": name or slug,
        "address": str(_field(rec, "address") or "").strip(),
        "state": state,
        "county": str(_field(rec, "county") or town or "").strip(),
        "town": town,
        "zipcode": str(_field(rec, "zipcode") or "").strip(),
        "category": str(_field(rec, "category") or "").strip(),
        "rating": rating,
        "review_count": review_count,
        "phone": str(_field(rec, "phone") or "").strip(),
        "website": str(_field(rec, "website") or "").strip(),
        "sentiment_p": sentiment_p,
        "freshness_f": freshness_f,
        "ai_score": ai_score,
        "assessment_level": "MODERATE",
        "place_id": place_id or None,
        "google_place_id": place_id or None,
        "profile_updated_at": _field(rec, "profile_updated_at"),
        **dims,
        "is_listed": _is_listed(rec),
    }


def insert_chunks(
    supabase_url: str,
    headers: Dict[str, str],
    rows: List[Dict[str, Any]],
    batch_size: int = 100,
) -> int:
    inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        resp = requests.post(
            f"{supabase_url}/rest/v1/restr_ai_leaderboard",
            headers=headers,
            json=batch,
            timeout=120,
        )
        if not resp.ok:
            detail = resp.text[:500]
            hint = ""
            if resp.status_code in (404, 406) or "restr_ai_leaderboard" in detail:
                hint = " Run sql/034_restr_ai_leaderboard.sql in Supabase SQL Editor first."
            raise RuntimeError(f"Insert failed ({resp.status_code}): {detail}.{hint}")
        inserted += len(batch)
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest restr_ai_leaderboard from Google profiles.")
    parser.add_argument("--limit", type=int, default=0, help="Max source rows to ingest (0 = all)")
    parser.add_argument("--max-rows", type=int, default=0, help="Stop fetching after N rows from Supabase (debug aid)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    supabase_url, key, headers = supabase_config()
    if not supabase_url or not key:
        raise SystemExit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment "
            "(see .env.local.example)."
        )

    # --max-rows caps the fetch (faster dry-runs); --limit caps what we score+insert.
    fetch_cap = args.max_rows or args.limit
    source, source_table = fetch_source_rows(supabase_url, headers, max_rows=fetch_cap)
    if args.limit and args.limit > 0:
        source = source[: args.limit]

    rows = [build_row(rec) for rec in source]
    rows = [r for r in rows if r]
    assign_assessment_levels_by_ai_score_percentile(rows)

    print(f"Prepared {len(rows)} restr_ai_leaderboard rows from {source_table}")
    if args.dry_run:
        # Level distribution first (always useful).
        from collections import Counter
        level_counts = Counter(r["assessment_level"] for r in rows)
        scores = [r["ai_score"] for r in rows]
        print(f"  levels: {dict(level_counts)}")
        print(f"  score:  min={min(scores):.1f} p25={sorted(scores)[len(scores)//4]:.1f} "
              f"median={sorted(scores)[len(scores)//2]:.1f} p75={sorted(scores)[3*len(scores)//4]:.1f} "
              f"max={max(scores):.1f}")
        # If --limit unset, show top 20 by score. Otherwise show the (chronological) first N.
        if args.limit and args.limit > 0:
            preview = rows[: args.limit]
            print(f"  first {len(preview)} (by source order):")
        else:
            preview = sorted(rows, key=lambda r: -r["ai_score"])[:20]
            print(f"  top 20 by ai_score:")
        for row in preview:
            print(
                f"    {row['ai_score']:5.1f}  {row['assessment_level']:9s}  "
                f"{row['slug']:50s}  {row['town']}, {row['state']}"
            )
        return

    inserted = insert_chunks(supabase_url, headers, rows)
    print(f"Inserted {inserted} rows")


if __name__ == "__main__":
    main()
