#!/usr/bin/env python3
"""
Recompute ai_score, sentiment_p, freshness_f, assessment_level for all
info_gather_google_profiles_latest rows using the Python scoring logic.

Fetches in pages, scores the full cohort for percentile-based assessment_level,
then batch-upserts back by id.

Usage:
  .venv/bin/python3 scripts/recompute_scores.py
  .venv/bin/python3 scripts/recompute_scores.py --dry-run
  .venv/bin/python3 scripts/recompute_scores.py --fetch-chunk 1000 --write-chunk 200
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipelines"))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

import leaderboard_scoring as lbs


def fetch_all(client, fetch_chunk: int) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        batch = (
            client.table("info_gather_google_profiles_latest")
            .select("id,slug,rating,review_count,sentiment_p,freshness_f,ai_score,assessment_level")
            .eq("is_listed", True)
            .range(offset, offset + fetch_chunk - 1)
            .execute()
        ).data or []
        rows.extend(batch)
        print(f"  fetched {len(rows)} …", flush=True)
        if len(batch) < fetch_chunk:
            break
        offset += fetch_chunk
        time.sleep(0.3)
    return rows


def recompute(dry_run: bool, fetch_chunk: int, write_chunk: int) -> None:
    from supabase import create_client
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    print(f"Fetching all leaderboard rows (chunk={fetch_chunk}) …", flush=True)
    all_rows = fetch_all(client, fetch_chunk)
    print(f"Total: {len(all_rows)} rows", flush=True)

    # Compute scores
    scored: list[dict] = []
    for row in all_rows:
        rating = float(row.get("rating") or 0)
        review_count = int(row.get("review_count") or 0)
        m = lbs.compute_leaderboard_metrics(rating, review_count, None, None)
        scored.append({
            "id": row["id"],
            "slug": row["slug"],
            "sentiment_p": m["sentiment_p"],
            "freshness_f": m["freshness_f"],
            "ai_score": m["ai_score"],
            "assessment_level": "",  # set by percentile pass below
        })

    # Percentile-based assessment_level across full cohort
    lbs.assign_assessment_levels_by_ai_score_percentile(scored)

    changed = [
        r for r, orig in zip(scored, all_rows)
        if (r["ai_score"] != orig.get("ai_score")
            or r["assessment_level"] != orig.get("assessment_level"))
    ]
    print(f"{len(changed)} rows have changed scores", flush=True)

    if dry_run:
        print("[DRY RUN] Sample:")
        for r in changed[:5]:
            print(f"  {r['slug']}  ai_score={r['ai_score']}  level={r['assessment_level']}")
        return

    # Batch update via async httpx — one PATCH per row but all concurrent
    import asyncio
    import httpx

    sb_url = os.environ["SUPABASE_URL"].rstrip("/")
    sb_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    async def _update_row(session: httpx.AsyncClient, row: dict, sem: asyncio.Semaphore) -> None:
        payload = {
            "sentiment_p":    row["sentiment_p"],
            "freshness_f":    row["freshness_f"],
            "ai_score":       row["ai_score"],
            "assessment_level": row["assessment_level"],
        }
        url = f"{sb_url}/rest/v1/info_gather_google_profiles?id=eq.{row['id']}"
        async with sem:
            for attempt in range(3):
                try:
                    r = await session.patch(url, json=payload, headers=headers, timeout=15)
                    r.raise_for_status()
                    return
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1)

    async def _run_all(rows: list[dict], concurrency: int) -> int:
        sem = asyncio.Semaphore(concurrency)
        done = 0
        async with httpx.AsyncClient(http2=True) as session:
            tasks = [_update_row(session, r, sem) for r in rows]
            for i, coro in enumerate(asyncio.as_completed(tasks), 1):
                await coro
                done += 1
                if done % 2000 == 0:
                    print(f"  {done}/{len(rows)} updated …", flush=True)
        return done

    print(f"Updating {len(changed)} changed rows (concurrency=50) …", flush=True)
    total = asyncio.run(_run_all(changed, concurrency=50))
    print(f"Done. {total} rows rescored.", flush=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--fetch-chunk", type=int, default=1000)
    p.add_argument("--write-chunk", type=int, default=500)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    recompute(dry_run=args.dry_run, fetch_chunk=args.fetch_chunk, write_chunk=args.write_chunk)


if __name__ == "__main__":
    main()
