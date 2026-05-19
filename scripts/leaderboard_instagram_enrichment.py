#!/usr/bin/env python3
"""
Enrich public.salon_ai_leaderboard with Instagram profile info.

Flow:
  salon_ai_leaderboard_latest -> stored website (if present) or place_id/google_place_id
  -> Places websiteUri -> fetch website HTML -> extract first Instagram profile URL
  -> update row by id.

Required env:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - GOOGLE_PLACES_API_KEY

Before first run, execute:
  sql/024_salon_ai_leaderboard_instagram_columns.sql

Examples:
  python3 scripts/leaderboard_instagram_enrichment.py --limit 200
  python3 scripts/leaderboard_instagram_enrichment.py --sleep 0.2
  python3 scripts/leaderboard_instagram_enrichment.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT_DEFAULT = ROOT / "data" / "leaderboard_instagram_enrichment_checkpoint.json"
TABLE = "salon_ai_leaderboard"
LATEST_VIEW = "salon_ai_leaderboard_latest"

INSTAGRAM_RE = re.compile(
    r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?(?:\?|#|$)",
    re.IGNORECASE,
)
SKIP_SEGMENTS = {"p", "reel", "reels", "stories", "explore", "tv", "accounts"}


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_checkpoint(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"processed_ids": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("processed_ids"), list):
            return data
    except Exception:
        pass
    return {"processed_ids": []}


def _save_checkpoint(path: Path, processed_ids: set[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "processed_ids": sorted(processed_ids),
        "updated_at": _now_iso(),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _normalized_instagram(url: str) -> tuple[str, str] | None:
    m = INSTAGRAM_RE.search(url or "")
    if not m:
        return None
    handle = m.group(1).strip()
    if not handle or handle.lower() in SKIP_SEGMENTS:
        return None
    return f"https://www.instagram.com/{handle}/", handle


def _extract_instagram_from_html(html: str) -> tuple[str, str] | None:
    for m in INSTAGRAM_RE.finditer(html or ""):
        handle = (m.group(1) or "").strip()
        if not handle or handle.lower() in SKIP_SEGMENTS:
            continue
        return f"https://www.instagram.com/{handle}/", handle
    return None


def _safe_get(client: httpx.Client, url: str) -> str:
    try:
        r = client.get(url, follow_redirects=True)
        if r.status_code >= 400:
            return ""
        return r.text or ""
    except Exception:
        return ""


def _update_with_retry(
    supabase: Any,
    row_id: str,
    payload: dict[str, Any],
    *,
    max_attempts: int = 5,
    base_sleep_s: float = 1.0,
) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            supabase.table(TABLE).update(payload).eq("id", row_id).execute()
            return
        except Exception as exc:
            msg = str(exc)
            is_pool_timeout = "PGRST003" in msg or "Timed out acquiring connection from connection pool" in msg
            is_transient_network = (
                "ReadError" in msg
                or "Connection reset by peer" in msg
                or "ReadTimeout" in msg
                or "read operation timed out" in msg.lower()
            )
            if attempt >= max_attempts or not (is_pool_timeout or is_transient_network):
                raise
            time.sleep(base_sleep_s * attempt)


def _get_places_website(http: httpx.Client, api_key: str, place_id: str) -> str:
    if not place_id:
        return ""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    try:
        r = http.get(
            url,
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "websiteUri",
            },
            follow_redirects=True,
        )
        if r.status_code >= 400:
            return ""
        data = r.json()
        return str(data.get("websiteUri") or "").strip()
    except Exception:
        return ""


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich leaderboard with Instagram profile URL.")
    parser.add_argument("--limit", type=int, default=0, help="Process at most N rows (0 = all)")
    parser.add_argument("--state", type=str, default="", help="Only process rows for this state code (e.g. PA)")
    parser.add_argument("--sleep", type=float, default=0.15, help="Sleep between rows")
    parser.add_argument("--dry-run", action="store_true", help="Do not write updates")
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=CHECKPOINT_DEFAULT,
        help="Checkpoint JSON path for resume support",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip row ids already in checkpoint",
    )
    args = parser.parse_args()

    _load_env()
    supabase_url = (os.environ.get("SUPABASE_URL") or "").strip()
    supabase_key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    places_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    if not places_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is required")

    supabase = create_client(supabase_url, supabase_key)

    query = (
        supabase.table(LATEST_VIEW)
        .select("id,slug,name,state,place_id,google_place_id,website")
        .order("updated_at", desc=False)
    )
    state_filter = (args.state or "").strip().upper()
    if state_filter:
        query = query.eq("state", state_filter)
    if args.limit and args.limit > 0:
        query = query.limit(args.limit)

    rows = query.execute().data or []
    checkpoint = _load_checkpoint(args.checkpoint) if args.resume else {"processed_ids": []}
    processed_ids = set(str(x) for x in checkpoint.get("processed_ids", []))

    total = len(rows)
    attempted = 0
    found = 0
    updated = 0

    with httpx.Client(timeout=25.0) as http:
        for idx, row in enumerate(rows, 1):
            rid = str(row.get("id") or "").strip()
            if not rid:
                continue
            if args.resume and rid in processed_ids:
                continue
            attempted += 1

            slug = str(row.get("slug") or "").strip()
            place_id = str(row.get("google_place_id") or row.get("place_id") or "").strip()
            website = str(row.get("website") or "").strip()
            website_source = "website" if website else ""
            if not website:
                website = _get_places_website(http, places_key, place_id)
                website_source = "places_website" if website else ""
            insta = _normalized_instagram(website) if website else None
            source = website_source if insta else ""

            if not insta and website:
                html = _safe_get(http, website)
                insta = _extract_instagram_from_html(html)
                if insta:
                    source = "website"

            if insta:
                found += 1
                insta_url, insta_handle = insta
            else:
                insta_url, insta_handle = "", ""

            state = str(row.get("state") or "").strip().upper()
            print(
                f"[{idx}/{total}] {slug or rid} | state={state or '-'} | website={'yes' if website else 'no'} | instagram={insta_handle or '-'}",
                flush=True,
            )

            if not args.dry_run:
                payload = {
                    "website": website,
                    "instagram_url": insta_url,
                    "instagram_handle": insta_handle,
                    "instagram_source": source,
                    "instagram_checked_at": _now_iso(),
                }
                _update_with_retry(supabase, rid, payload)
                updated += 1

            processed_ids.add(rid)
            if attempted % 25 == 0:
                _save_checkpoint(args.checkpoint, processed_ids)
            if args.sleep > 0:
                time.sleep(args.sleep)

    _save_checkpoint(args.checkpoint, processed_ids)
    print(
        f"Done. attempted={attempted} found_instagram={found} updated_rows={updated} dry_run={args.dry_run}",
        flush=True,
    )


if __name__ == "__main__":
    main()
