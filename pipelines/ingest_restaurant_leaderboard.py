"""
Ingest restaurant_leaderboard from info_gather_google_profiles + info_gather_restaurants.

- Generates deterministic slugs: {kebab-title}-{md5(place_id)[:10]}
- Upserts into restaurant_leaderboard (on slug)
- Assigns cohort-relative assessment_level after scoring all rows

Usage:
  python3 pipelines/ingest_restaurant_leaderboard.py [--limit N] [--dry-run]
"""

import argparse, hashlib, math, os, re, time
import requests
from restaurant_scoring import (
    score_restaurant, assessment_level, WEIGHTS,
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://supabase.360ai.link")
KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjI0MDUyMDAsImV4cCI6MTkyMDE3MTYwMH0."
    "0Scyjnrqt727pMYFEP5n-MBF3OcL2SyDUhgUTSLHLCE",
)
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


# ── Slug generation ────────────────────────────────────────────────────────────

def make_slug(title: str, place_id: str) -> str:
    """Deterministic slug: {kebab(title)}-{md5(place_id)[:10]}"""
    base = re.sub(r"[^a-z0-9]+", "-", (title or "restaurant").lower()).strip("-")[:40]
    suffix = hashlib.md5(place_id.encode()).hexdigest()[:10]
    candidate = f"{base}-{suffix}"
    # ensure format matches ^[a-z0-9]+(?:-[a-z0-9]+)*$
    if re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", candidate):
        return candidate
    return f"restaurant-{suffix}"


# ── Supabase fetch helpers ─────────────────────────────────────────────────────

def fetch_all(table, params=None, page_size=500):
    rows, offset = [], 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers={**HEADERS, "Range-Unit": "items", "Range": f"{offset}-{offset+page_size-1}"},
            params=params or {},
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


def upsert_rows(rows, batch_size=200):
    for i in range(0, len(rows), batch_size):
        batch = rows[i: i + batch_size]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/restaurant_leaderboard",
            headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=batch,
            timeout=60,
        )
        if not resp.ok:
            raise RuntimeError(f"Upsert failed: {resp.status_code} {resp.text[:200]}")
        print(f"  upserted {min(i+batch_size, len(rows)):,}/{len(rows):,}", end="\r")
    print()


# ── Main ──────────────────────────────────────────────────────────────────────

def run(limit=None, dry_run=False):
    print("Fetching google profiles …")
    profiles = fetch_all(
        "info_gather_google_profiles",
        params={"order": "reviews_count.desc", "match_status": "eq.accepted"},
        page_size=500,
    )
    if limit:
        profiles = profiles[:limit]
    print(f"  {len(profiles):,} profiles")

    print("Fetching DOH restaurant data …")
    restaurants = fetch_all(
        "info_gather_restaurants",
        params={"select": "id,camis,latest_grade,latest_score,cuisine_description,boro"},
        page_size=1000,
    )
    rest_by_camis = {r["camis"]: r for r in restaurants}
    print(f"  {len(restaurants):,} restaurant DOH records")

    # ── Score all ─────────────────────────────────────────────────────────────
    print("Scoring …")
    scored = []
    for p in profiles:
        r = rest_by_camis.get(p.get("camis"), {})
        s = score_restaurant(r, p)
        s["place_id"] = p.get("place_id") or ""
        scored.append((p, r, s))

    # ── Cohort percentile → assessment_level ──────────────────────────────────
    scored.sort(key=lambda x: x[2]["restaurant_score"], reverse=True)
    n = len(scored)
    for i, (p, r, s) in enumerate(scored):
        s["assessment_level"] = assessment_level(i / max(n, 1))

    # ── Build leaderboard rows ─────────────────────────────────────────────────
    rows = []
    seen_slugs = set()
    for p, r, s in scored:
        place_id = p.get("place_id") or ""
        if not place_id:
            continue
        title = p.get("title") or ""
        slug = make_slug(title, place_id)
        # deduplicate (same business, multiple camis entries)
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        rows.append({
            "slug":              slug,
            "place_id":          place_id,
            "camis":             p.get("camis"),
            "name":              title,
            "address":           p.get("address"),
            "city":              p.get("city"),
            "zipcode":           p.get("postal_code"),
            "category":          p.get("category_name") or (p.get("categories") or [None])[0],
            "phone":             p.get("phone"),
            "website":           p.get("website"),
            "image_url":         p.get("image_url"),
            "rating":            p.get("rating"),
            "review_count":      p.get("reviews_count", 0),
            "reviews_distribution": p.get("reviews_distribution"),
            "latest_grade":      r.get("latest_grade"),
            "latest_score":      r.get("latest_score"),
            "dim_rating_score":        s["dim_rating_score"],
            "dim_volume_score":        s["dim_volume_score"],
            "dim_sentiment_score":     s["dim_sentiment_score"],
            "dim_food_safety_score":   s["dim_food_safety_score"],
            "dim_profile_score":       s["dim_profile_score"],
            "dim_service_score":       s["dim_service_score"],
            "dim_value_score":         s["dim_value_score"],
            "dim_ops_score":           s["dim_ops_score"],
            "dim_conversion_score":    s["dim_conversion_score"],
            "restaurant_score":        s["restaurant_score"],
            "assessment_level":        s["assessment_level"],
            "match_confidence":        p.get("match_confidence"),
            "match_status":            p.get("match_status"),
            "is_listed":               True,
        })

    # Stats
    scores = [r["restaurant_score"] for r in rows]
    levels = {}
    for r in rows:
        levels[r["assessment_level"]] = levels.get(r["assessment_level"], 0) + 1

    print(f"\n{'='*55}")
    print(f"Leaderboard rows: {len(rows):,}  (deduped by slug)")
    print(f"Score: min={min(scores):.1f}  max={max(scores):.1f}  median={sorted(scores)[len(scores)//2]:.1f}")
    print("Levels:", levels)
    print(f"\nSample slugs:")
    for row in rows[:5]:
        print(f"  {row['slug']:<50}  {row['restaurant_score']:.1f}  {row['assessment_level']}")

    if dry_run:
        print("\n[dry-run] no upsert.")
        return rows

    print(f"\nUpserting {len(rows):,} rows → restaurant_leaderboard …")
    upsert_rows(rows)
    print(f"Done. {len(rows):,} rows upserted.")
    return rows


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    run(limit=args.limit, dry_run=args.dry_run)
