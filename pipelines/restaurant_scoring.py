"""
Restaurant Diagnostic Score — Python implementation (mirrors restaurant-scoring.js).

9 indicators, Bayesian-adjusted composite 0–100.

Indicator weights:
  D1  口碑星级  Rating Quality        0.20
  D2  评价量级  Review Volume         0.15
  D3  口碑情感  Review Sentiment      0.15
  D4  食品安全  Food Safety           0.15  ← DOH grade (restaurant-exclusive)
  D5  信息完整度 Profile Completeness  0.12
  D6  服务广度  Service Breadth       0.10
  D7  价值定位  Price-Value Ratio     0.08
  D8  运营活跃  Operational Activity   0.03
  D9  转化就绪  Conversion Readiness   0.02
"""

import math
import os
import time
from typing import Optional
import requests

# ─── helpers ──────────────────────────────────────────────────────────────────

def clamp(v, lo=0.0, hi=100.0):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return lo


def r1(v):
    return round(clamp(v) * 10) / 10


# ─── D1  口碑星级  Rating Quality ─────────────────────────────────────────────

def rating_score(rating) -> float:
    """Restaurant ratings cluster 3.5–5.0; map to 0–100."""
    r = clamp(rating or 0, 1, 5)
    return r1(max(0.0, (r - 3.5) / 1.5) * 100)


# ─── D2  评价量级  Review Volume ──────────────────────────────────────────────

VOLUME_PLATEAU = 2000  # restaurants plateau higher than salons (900)

def volume_score(review_count) -> float:
    n = max(0, int(review_count or 0))
    return r1(math.log10(n + 1) / math.log10(VOLUME_PLATEAU) * 100)


# ─── D3  口碑情感  Review Sentiment ───────────────────────────────────────────

def sentiment_score(reviews_distribution, rating=None) -> float:
    dist = reviews_distribution or {}
    one   = int(dist.get("oneStar",   0) or 0)
    two   = int(dist.get("twoStar",   0) or 0)
    three = int(dist.get("threeStar", 0) or 0)
    four  = int(dist.get("fourStar",  0) or 0)
    five  = int(dist.get("fiveStar",  0) or 0)
    total = one + two + three + four + five

    if total > 0:
        avg_star = (one + two*2 + three*3 + four*4 + five*5) / total
        raw = ((avg_star - 1) / 4) * 100
    else:
        r = clamp(rating or 0, 1, 5)
        raw = ((r - 1) / 4) * 100

    # Red-alert caps
    if one >= 3:
        raw = min(raw, 45)
    elif one >= 1:
        raw = min(raw, 60)

    return r1(clamp(raw))


# ─── D4  食品安全  Food Safety (DOH grade) ────────────────────────────────────

GRADE_BASE = {"A": 100, "B": 70, "C": 40, "Z": 50, "N": 50}

def food_safety_score(latest_grade, latest_score) -> float:
    base = GRADE_BASE.get(str(latest_grade or "").upper(), 50)
    try:
        doh = int(latest_score)
        penalty = max(0, doh - 13) * 0.8   # each point above A-threshold costs 0.8
    except (TypeError, ValueError):
        penalty = 0
    return r1(clamp(base - penalty))


# ─── D5  信息完整度  Profile Completeness ─────────────────────────────────────

def profile_score(p: dict) -> float:
    def has(v):
        if v is None: return False
        if isinstance(v, (list, dict)): return len(v) > 0
        return str(v).strip() != ""

    return r1(
        (22 if has(p.get("best_menu_url"))  else 0) +
        (18 if has(p.get("phone"))          else 0) +
        (16 if has(p.get("website"))        else 0) +
        (16 if has(p.get("opening_hours"))  else 0) +
        (14 if has(p.get("price"))          else 0) +
        ( 8 if has(p.get("categories"))     else 0) +
        ( 6 if has(p.get("image_url"))      else 0)
    )


# ─── D6  服务广度  Service Breadth ────────────────────────────────────────────

def _flag(additional_info, section, key):
    """Return True/False/None (None = not mentioned)."""
    items = (additional_info or {}).get(section, [])
    if not isinstance(items, list):
        return None
    for item in items:
        if isinstance(item, dict) and key in item:
            return bool(item[key])
    return None


def service_score(additional_info) -> float:
    delivery    = _flag(additional_info, "Service options", "Delivery")
    takeout     = _flag(additional_info, "Service options", "Takeout")
    dine_in     = _flag(additional_info, "Service options", "Dine-in")
    table_svc   = _flag(additional_info, "Dining options",  "Table service")
    reservation = (_flag(additional_info, "Planning", "Accepts reservations") or
                   _flag(additional_info, "Planning", "Reservations recommended"))

    score = 0
    score += 25 if delivery    is True else (12 if delivery    is None else 0)
    score += 20 if takeout     is True else (10 if takeout     is None else 0)
    score += 25 if dine_in     is True else (12 if dine_in     is None else 0)
    score += 15 if table_svc   is True else ( 7 if table_svc   is None else 0)
    score += 15 if reservation is True else ( 7 if reservation is None else 0)
    return r1(clamp(score))


# ─── D7  价值定位  Price-Value Ratio ──────────────────────────────────────────

def value_score(price, rating) -> float:
    r_score = rating_score(rating) / 100  # 0–1
    p = str(price or "").strip()
    if p in ("$",) or p.startswith("$1") or p == "$1–10":
        mult = 1.20
    elif p == "$$" or (p.startswith("$1") and "–" in p):
        mult = 1.00
    elif p == "$$$" or any(p.startswith(f"${i}") for i in range(20, 40)):
        mult = 0.80
    elif p == "$$$$" or any(p.startswith(f"${i}") for i in range(40, 1000)):
        mult = 0.65
    else:
        mult = 1.00
    return r1(clamp(r_score * mult * 100))


# ─── D8  运营活跃  Operational Activity ──────────────────────────────────────

def ops_score(p: dict) -> float:
    if p.get("permanently_closed"):
        return 0.0
    score = 40
    if not p.get("temporarily_closed"):
        score += 30
    if p.get("opening_hours"):
        score += 20
    pt = p.get("popular_times_histogram") or {}
    if isinstance(pt, dict) and pt:
        score += 10
    return r1(clamp(score))


# ─── D9  转化就绪  Conversion Readiness ─────────────────────────────────────

def conversion_score(p: dict) -> float:
    def has(v):
        return v is not None and str(v).strip() != ""
    return r1(
        (50 if has(p.get("phone"))             else 0) +
        (30 if has(p.get("best_menu_url"))     else 0) +
        (20 if has(p.get("reserve_table_url")) else 0)
    )


# ─── Composite restaurant_score ───────────────────────────────────────────────

WEIGHTS = dict(D1=0.20, D2=0.15, D3=0.15, D4=0.15, D5=0.12,
               D6=0.10, D7=0.08, D8=0.03, D9=0.02)

assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"


def calc_restaurant_score(dims: dict, review_count) -> float:
    blend = sum(dims[k] * WEIGHTS[k] for k in WEIGHTS)
    n = max(0, int(review_count or 0))
    conf = 1 - math.exp(-n / 80)   # 50% at ~55 reviews, 90% at ~184
    prior = 0.50
    adjusted = prior + (blend / 100 - prior) * (0.30 + 0.70 * conf)
    return round(clamp(adjusted * 100) * 10) / 10


def assessment_level(frac_from_top: float) -> str:
    """Cohort-relative percentile band."""
    f = float(frac_from_top) if frac_from_top is not None else 0.5
    if f < 0.10: return "EXCELLENT"
    if f < 0.30: return "GOOD"
    if f < 0.60: return "MODERATE"
    if f < 0.80: return "LOW"
    return "RISKY"


def score_restaurant(restaurant: dict, profile: dict) -> dict:
    """Score one restaurant. Returns a dict ready to upsert into diagnostic table."""
    p = profile or {}
    r = restaurant or {}

    D1 = rating_score(p.get("rating"))
    D2 = volume_score(p.get("reviews_count", 0))
    D3 = sentiment_score(p.get("reviews_distribution"), p.get("rating"))
    D4 = food_safety_score(r.get("latest_grade"), r.get("latest_score"))
    D5 = profile_score(p)
    D6 = service_score(p.get("additional_info"))
    D7 = value_score(p.get("price"), p.get("rating"))
    D8 = ops_score(p)
    D9 = conversion_score(p)

    dims = dict(D1=D1, D2=D2, D3=D3, D4=D4, D5=D5, D6=D6, D7=D7, D8=D8, D9=D9)
    restaurant_score = calc_restaurant_score(dims, p.get("reviews_count", 0))

    return {
        "restaurant_id":        p.get("restaurant_id") or r.get("id"),
        "camis":                p.get("camis") or r.get("camis"),
        "place_id":             p.get("place_id"),
        "rating":               p.get("rating"),
        "review_count":         p.get("reviews_count", 0),
        "latest_grade":         r.get("latest_grade"),
        "latest_score":         r.get("latest_score"),
        "dim_rating_score":     D1,
        "dim_volume_score":     D2,
        "dim_sentiment_score":  D3,
        "dim_food_safety_score": D4,
        "dim_profile_score":    D5,
        "dim_service_score":    D6,
        "dim_value_score":      D7,
        "dim_ops_score":        D8,
        "dim_conversion_score": D9,
        "restaurant_score":     restaurant_score,
        "match_confidence":     p.get("match_confidence"),
        "match_status":         p.get("match_status"),
    }


# ─── Batch runner ─────────────────────────────────────────────────────────────

def run_batch(limit=None, dry_run=False):
    """Fetch from Supabase, compute scores, print summary."""
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://supabase.360ai.link")
    KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjI0MDUyMDAsImV4cCI6MTkyMDE3MTYwMH0."
        "0Scyjnrqt727pMYFEP5n-MBF3OcL2SyDUhgUTSLHLCE")
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

    # fetch profiles (join camis → restaurant for DOH data)
    page, rows = 0, []
    page_size = min(limit or 500, 500)
    print("Fetching google profiles …")
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/info_gather_google_profiles",
            headers={**headers, "Range-Unit": "items",
                     "Range": f"{page}-{page + page_size - 1}"},
            params={"order": "created_at.asc"},
            timeout=30)
        resp.raise_for_status()
        batch = resp.json()
        if not batch: break
        rows.extend(batch)
        print(f"  {len(rows)} profiles …", end="\r")
        if len(batch) < page_size or (limit and len(rows) >= limit): break
        page += page_size
        time.sleep(0.05)
    print(f"  {len(rows)} profiles fetched.   ")

    # build camis → restaurant lookup
    print("Fetching restaurant DOH data …")
    rest_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/info_gather_restaurants",
        headers={**headers, "Range-Unit": "items", "Range": "0-9999"},
        params={"select": "id,camis,latest_grade,latest_score", "order": "camis.asc"},
        timeout=60)
    rest_resp.raise_for_status()
    rest_by_camis = {r["camis"]: r for r in rest_resp.json()}

    # score
    results = []
    for p in rows:
        r = rest_by_camis.get(p.get("camis"), {})
        results.append(score_restaurant(r, p))

    # sort and assign cohort levels
    results.sort(key=lambda x: x["restaurant_score"], reverse=True)
    n = len(results)
    for i, rec in enumerate(results):
        rec["assessment_level"] = assessment_level(i / max(n, 1))

    # summary
    scores = [r["restaurant_score"] for r in results]
    levels = {}
    for r in results:
        levels[r["assessment_level"]] = levels.get(r["assessment_level"], 0) + 1

    print(f"\n{'='*55}")
    print(f"Scored {n:,} restaurants")
    print(f"Score:  min={min(scores):.1f}  max={max(scores):.1f}  "
          f"median={sorted(scores)[n//2]:.1f}")
    print("Assessment distribution:", levels)
    print()
    print(f"{'Indicator':<28} {'Mean':>6}  {'Weight':>7}")
    print("-" * 44)
    for k, w in WEIGHTS.items():
        col = {
            "D1": "dim_rating_score", "D2": "dim_volume_score",
            "D3": "dim_sentiment_score", "D4": "dim_food_safety_score",
            "D5": "dim_profile_score", "D6": "dim_service_score",
            "D7": "dim_value_score", "D8": "dim_ops_score",
            "D9": "dim_conversion_score",
        }[k]
        name = {
            "D1": "口碑星级 Rating Quality",
            "D2": "评价量级 Review Volume",
            "D3": "口碑情感 Sentiment",
            "D4": "食品安全 Food Safety",
            "D5": "信息完整度 Profile",
            "D6": "服务广度 Service Breadth",
            "D7": "价值定位 Price-Value",
            "D8": "运营活跃 Ops Activity",
            "D9": "转化就绪 Conversion",
        }[k]
        mean_val = sum(r[col] for r in results) / max(n, 1)
        print(f"  {name:<26} {mean_val:>6.1f}   {w*100:>5.0f}%")

    if dry_run:
        print("\n[dry-run] Sample top-5:")
        for rec in results[:5]:
            print(f"  {rec['restaurant_score']:>5.1f}  {rec['assessment_level']:<10}  "
                  f"grade={rec['latest_grade']}  rating={rec['rating']}  "
                  f"n={rec['review_count']}")
    return results


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=500)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    run_batch(limit=args.limit, dry_run=args.dry_run)
