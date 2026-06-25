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
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        resp = requests.get(
            f"{supabase_url}/rest/v1/{table}",
            headers={**headers, "Range-Unit": "items", "Range": f"{offset}-{offset + page_size - 1}"},
            params=params or {"is_listed": "eq.true", "select": "*", "order": "updated_at.desc"},
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
        time.sleep(0.05)
    return rows


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


def build_row(rec: Dict[str, Any]) -> Dict[str, Any] | None:
    place_id = str(rec.get("place_id") or rec.get("google_place_id") or "").strip()
    slug = str(rec.get("slug") or "").strip().lower()
    if not slug and place_id:
        slug = make_slug(str(rec.get("name") or ""), place_id)
    if not slug:
        return None

    rating = float(rec.get("rating") or 0)
    review_count = max(0, int(rec.get("review_count") or 0))
    hist = rec.get("reviews_distribution") or {}
    if hist:
        sentiment_p = sentiment_from_review_histogram(hist, review_count)
    else:
        sentiment_p = sentiment_fallback_from_rating(rating)
    freshness_f = freshness_heuristic(review_count, rec.get("reviews") or [])

    dim_signals = {
        "rating": rating,
        "reviewCount": review_count,
        "sentimentP": sentiment_p,
        "freshnessF": freshness_f,
        "phone": rec.get("phone"),
        "website": rec.get("website"),
        "address": rec.get("address"),
        "placeId": place_id,
        "menuUrl": rec.get("best_menu_url") or rec.get("menu_url"),
        "openingHours": rec.get("opening_hours"),
        "imageUrl": rec.get("image_url"),
        "categories": rec.get("categories"),
        "price": rec.get("price"),
        "delivery": rec.get("delivery"),
        "takeout": rec.get("takeout"),
        "dineIn": rec.get("dine_in"),
        "reservable": rec.get("reservable"),
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

    return {
        "slug": slug,
        "name": str(rec.get("name") or slug).strip(),
        "address": str(rec.get("address") or "").strip(),
        "state": str(rec.get("state") or "").strip(),
        "county": str(rec.get("county") or rec.get("city") or "").strip(),
        "town": str(rec.get("town") or rec.get("city") or "").strip(),
        "zipcode": str(rec.get("zipcode") or "").strip(),
        "category": str(rec.get("category") or "").strip(),
        "rating": rating,
        "review_count": review_count,
        "phone": str(rec.get("phone") or "").strip(),
        "website": str(rec.get("website") or "").strip(),
        "sentiment_p": sentiment_p,
        "freshness_f": freshness_f,
        "ai_score": ai_score,
        "assessment_level": "MODERATE",
        "place_id": place_id or None,
        "google_place_id": place_id or None,
        "profile_updated_at": rec.get("profile_updated_at") or rec.get("updated_at"),
        **dims,
        "is_listed": rec.get("is_listed", True) is not False,
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
        resp.raise_for_status()
        inserted += len(batch)
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest restr_ai_leaderboard from Google profiles.")
    parser.add_argument("--limit", type=int, default=0, help="Max source rows (0 = all)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    supabase_url, key, headers = supabase_config()
    if not supabase_url or not key:
        raise SystemExit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment "
            "(see .env.local.example)."
        )

    source = fetch_all(supabase_url, headers, "info_gather_google_profiles_latest")
    if args.limit and args.limit > 0:
        source = source[: args.limit]

    rows = [build_row(rec) for rec in source]
    rows = [r for r in rows if r]
    assign_assessment_levels_by_ai_score_percentile(rows)

    print(f"Prepared {len(rows)} restr_ai_leaderboard rows")
    if args.dry_run:
        for row in rows[:5]:
            print(
                f"  {row['slug']}: ai_score={row['ai_score']} "
                f"level={row['assessment_level']} town={row['town']}, {row['state']}"
            )
        if len(rows) > 5:
            print(f"  ... and {len(rows) - 5} more")
        return

    inserted = insert_chunks(supabase_url, headers, rows)
    print(f"Inserted {inserted} rows")


if __name__ == "__main__":
    main()
