#!/usr/bin/env python3
"""
Ingest AI leaderboard source JSON into public.salon_ai_leaderboard (append-only history).

Prerequisites:
  - Supabase: sql/013 … sql/021_leaderboard_slug_history_latest_view.sql
  - Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (load from repo root .env / .env.local)

Usage (from repo root):
  python3 pipelines/ingest_salon_ai_leaderboard.py [path/to/source.json]
  AI_LEADERBOARD_SOURCE_PATH=data/ai-leaderboard-source.json python3 pipelines/ingest_salon_ai_leaderboard.py
  npm run ingest:leaderboard:py   # same as above

Node (same JSON, scores via leaderboard-scoring.js): npm run ingest:leaderboard

Install deps:
  pip install -r pipelines/requirements.txt
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
if str(_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv  # noqa: E402

import leaderboard_scoring as lbs  # noqa: E402

INSTAGRAM_RE = re.compile(
    r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?(?:\?|#|$)",
    re.IGNORECASE,
)


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def _normalize_place_id(rec: dict[str, Any]) -> str | None:
    a = str(rec.get("place_id") or rec.get("placeId") or "").strip()
    b = str(rec.get("google_place_id") or rec.get("googlePlaceId") or "").strip()
    out = a or b
    return out or None


def _normalize_instagram(rec: dict[str, Any]) -> tuple[str, str]:
    raw_url = str(rec.get("instagram_url") or rec.get("instagramUrl") or rec.get("salon_instagram") or "").strip()
    raw_handle = str(rec.get("instagram_handle") or rec.get("instagramHandle") or "").strip().lstrip("@")
    if raw_url:
        m = INSTAGRAM_RE.search(raw_url)
        if m:
            handle = (m.group(1) or "").strip()
            if handle:
                return f"https://www.instagram.com/{handle}/", handle
    if raw_handle:
        return f"https://www.instagram.com/{raw_handle}/", raw_handle
    return "", ""


def source_row_to_insert(rec: dict[str, Any], index: int) -> dict[str, Any]:
    name = str(rec.get("name") or "").strip()
    if not name:
        raise ValueError(f"Row {index}: missing name")

    slug = lbs.ensure_slug(str(rec.get("slug") or "").strip() or None, name, index)
    rating = round(min(5.0, max(0.0, float(rec.get("rating") or 0))) * 100) / 100
    rc_raw = rec.get("review_count", rec.get("reviewCount", 0))
    try:
        review_count = max(0, int(float(rc_raw)))
    except (TypeError, ValueError):
        review_count = 0

    hist_raw = rec.get("star_histogram") or rec.get("starHistogram") or rec.get("histogram")
    reviews = rec.get("reviews") if isinstance(rec.get("reviews"), list) else None
    metrics = lbs.compute_leaderboard_metrics(rating, review_count, reviews, hist_raw)

    place_id = _normalize_place_id(rec)
    now = datetime.now(timezone.utc).isoformat()
    instagram_url, instagram_handle = _normalize_instagram(rec)
    instagram_source = str(
        rec.get("instagram_source")
        or rec.get("instagramSource")
        or ("maps_overview" if instagram_url else "")
    ).strip()
    instagram_checked_at = (
        rec.get("instagram_checked_at")
        or rec.get("instagramCheckedAt")
        or (now if instagram_url else None)
    )

    is_listed = not (rec.get("is_listed") is False or rec.get("isListed") is False)

    return {
        "slug": slug,
        "name": name,
        "address": str(rec.get("address") or "").strip(),
        "state": str(rec.get("state") or "").strip(),
        "county": str(rec.get("county") or "").strip(),
        "town": str(rec.get("town") or "").strip(),
        "zipcode": str(rec.get("zipcode") or rec.get("zip") or "").strip(),
        "category": str(rec.get("category") or "").strip(),
        "rating": rating,
        "review_count": review_count,
        "phone": str(rec.get("phone") or "").strip(),
        "website": str(rec.get("website") or rec.get("websiteUri") or "").strip(),
        "sentiment_p": metrics["sentiment_p"],
        "freshness_f": metrics["freshness_f"],
        "ai_score": metrics["ai_score"],
        "assessment_level": metrics["assessment_level"],
        "place_id": place_id,
        "google_place_id": place_id,
        "is_listed": is_listed,
        "instagram_url": instagram_url,
        "instagram_handle": instagram_handle,
        "instagram_source": instagram_source,
        "instagram_checked_at": instagram_checked_at,
        "profile_updated_at": rec.get("profile_updated_at") or rec.get("profileUpdatedAt"),
        "updated_at": now,
    }


def read_records(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("JSON root must be an array of salon objects")
    return [x for x in data if isinstance(x, dict)]


def ingest(records: list[dict[str, Any]], chunk_size: int = 100) -> tuple[int, list[str]]:
    from supabase import create_client  # noqa: WPS433 — optional until ingest runs

    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    rows = [source_row_to_insert(rec, i) for i, rec in enumerate(records)]
    client = create_client(url, key)
    lbs.apply_global_percentile_assessment_levels(client, rows)
    inserted = 0
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        client.table("salon_ai_leaderboard").insert(chunk).execute()
        inserted += len(chunk)
    return inserted, [r["slug"] for r in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest salon_ai_leaderboard rows from JSON.")
    parser.add_argument(
        "source_path",
        nargs="?",
        default=os.environ.get("AI_LEADERBOARD_SOURCE_PATH", "data/ai-leaderboard-source.json"),
        help="JSON array file (default: env AI_LEADERBOARD_SOURCE_PATH or data/ai-leaderboard-source.json)",
    )
    parser.add_argument("--chunk-size", type=int, default=100, help="Rows per insert batch (max 500)")
    args = parser.parse_args()

    _load_env()
    rel = Path(args.source_path)
    path = rel if rel.is_absolute() else ROOT / rel
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    records = read_records(path)
    if not records:
        print("No records to ingest.", file=sys.stderr)
        sys.exit(1)

    chunk = max(1, min(500, int(args.chunk_size)))
    n, slugs = ingest(records, chunk_size=chunk)
    print(f"Ingested {n} row(s). Slugs: {', '.join(slugs)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
