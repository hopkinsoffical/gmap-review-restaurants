"""
Mirror lib/server/leaderboard-scoring.js for salon_ai_leaderboard ingestion.

Scoring v2 (2026): see leaderboard-scoring.js — evidence-based ai_score,
histogram-mean sentiment. assessment_level in DB uses global cohort percentiles
(latest ∪ batch) when ingesting via apply_global_percentile_assessment_levels;
build_assessment_level remains as a fixed-threshold fallback for tooling.
"""

from __future__ import annotations

import math
import re
import time
from typing import Any, Mapping

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def empty_histogram() -> dict[int, int]:
    return {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}


def sum_histogram(hist: Mapping[int, Any] | None) -> int:
    h = hist or {}
    return sum(int(h.get(s, 0) or 0) for s in range(1, 6))


def normalize_histogram_input(raw: Any) -> dict[int, int] | None:
    if not isinstance(raw, dict):
        return None
    hist = empty_histogram()
    any_val = False
    for s in range(1, 6):
        v = raw.get(str(s), raw.get(s))
        if v is not None and v != "":
            try:
                n = int(float(v))
            except (TypeError, ValueError):
                continue
            if n >= 0:
                hist[s] = n
                any_val = True
    return hist if any_val else None


def count_stars_from_review_list(reviews: Any) -> dict[int, int]:
    hist = empty_histogram()
    if not isinstance(reviews, list):
        return hist
    for rv in reviews:
        if not isinstance(rv, dict):
            continue
        try:
            rating = float(rv.get("rating"))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(rating):
            continue
        rounded = int(round(rating))
        if 1 <= rounded <= 5:
            hist[rounded] += 1
    return hist


def classify_store_signals(
    histogram: Mapping[int, Any] | None,
    meta: dict[str, Any] | None,
) -> dict[str, Any]:
    hist = dict(empty_histogram())
    if histogram:
        for s in range(1, 6):
            hist[s] = int(histogram.get(s, 0) or 0)
    c1 = hist[1]
    c2 = hist[2]
    total = sum_histogram(hist)
    incomplete = bool(meta and meta.get("histogramIncomplete"))
    total_on_google = meta.get("userRatingTotal") if meta else None
    try:
        total_on_google_f = float(total_on_google) if total_on_google is not None else None
    except (TypeError, ValueError):
        total_on_google_f = None

    base: dict[str, Any] = {
        "qualityTier": None,
        "redAlert": False,
        "histogramIncomplete": incomplete,
    }

    if total == 0:
        base["qualityTier"] = "unknown"
        return base

    if c1 >= 3:
        return {**base, "redAlert": True, "qualityTier": "alert"}
    if c1 == 2:
        return {**base, "redAlert": True, "qualityTier": "alert"}
    if c1 == 1:
        return {**base, "redAlert": True, "qualityTier": "alert"}
    if c2 >= 1:
        return {**base, "redAlert": True, "qualityTier": "alert"}

    present = [s for s in range(1, 6) if hist[s] > 0]
    min_star = min(present)
    max_star = max(present)

    quality_tier = "mixed"
    if min_star == 5 and max_star == 5:
        quality_tier = "excellent"
    elif min_star >= 4:
        quality_tier = "good"
    elif min_star >= 3:
        quality_tier = "moderate"

    out = {**base, "qualityTier": quality_tier, "redAlert": False}
    if incomplete and total_on_google_f is not None and total_on_google_f > total:
        out["notes"] = "histogram sample smaller than Google total"
    return out


def sentiment_from_review_histogram(histogram: Mapping[int, Any] | None, user_rating_total: int) -> float:
    meta = {"userRatingTotal": user_rating_total, "histogramIncomplete": True}
    sig = classify_store_signals(histogram, meta)
    if sig.get("redAlert"):
        return 0.58

    hist = dict(histogram or {})
    total = 0
    wsum = 0.0
    for s in range(1, 6):
        c = int(hist.get(s, 0) or 0)
        total += c
        wsum += float(s) * c
    if total <= 0:
        return 0.8

    avg_star = wsum / total
    linear = (avg_star - 1.0) / 4.0
    return round(min(0.98, max(0.45, linear)) * 1000) / 1000


def calc_ai_score(rating: float, review_count: int, sentiment_p: float, freshness_f: float) -> float:
    r = float(rating) if rating is not None else 0.0
    r = min(5.0, max(1.0, r))
    n = max(0, int(review_count or 0))
    pn = sentiment_p if math.isfinite(sentiment_p) else 0.72
    pn = min(1.0, max(0.0, pn))
    fn = freshness_f if math.isfinite(freshness_f) else 0.7
    fn = min(1.0, max(0.0, fn))

    rating_norm = min(1.0, max(0.0, (r - 3.0) / 2.0))
    volume_norm = min(1.0, math.log10(n + 1) / math.log10(900))
    blend = rating_norm * 0.31 + volume_norm * 0.33 + pn * 0.22 + fn * 0.14
    conf = 1.0 - math.exp(-n / 52.0)
    prior = 0.52
    adjusted = prior + (blend - prior) * (0.36 + 0.64 * conf)
    out = adjusted * 100.0
    return round(min(100.0, max(0.0, out)) * 10) / 10


def assessment_level_from_fraction_from_top(frac: float) -> str:
    """0 = best in cohort. Bands: 10% / 20% / 30% / 20% / 20% (GOOD 10–30%, fair MODERATE 30–60%)."""
    if not math.isfinite(frac) or frac < 0:
        return "MODERATE"
    if frac < 0.1:
        return "EXCELLENT"
    if frac < 0.3:
        return "GOOD"
    if frac < 0.6:
        return "MODERATE"
    if frac < 0.8:
        return "LOW"
    return "RISKY"


def assign_assessment_levels_by_ai_score_percentile(rows: list[dict[str, Any]]) -> None:
    """Set assessment_level by ai_score rank within ``rows`` (desc). Mutates rows."""
    triples = [(i, str(r.get("slug") or "").strip(), float(r.get("ai_score") or 0)) for i, r in enumerate(rows)]
    triples = [t for t in triples if t[1]]
    triples.sort(key=lambda t: (-t[2], t[1]))
    n = len(triples)
    if n == 0:
        return
    for k, (orig_i, _slug, _sc) in enumerate(triples):
        frac = 0.0 if n == 1 else k / n
        rows[orig_i]["assessment_level"] = assessment_level_from_fraction_from_top(frac)


def apply_global_percentile_assessment_levels(client: Any, rows: list[dict[str, Any]]) -> None:
    """Merge DB latest listed scores with this batch; set each row's assessment_level."""
    resp = client.table("salon_ai_leaderboard_latest").select("slug", "ai_score").execute()
    merged: dict[str, float] = {}
    for item in resp.data or []:
        s = str(item.get("slug") or "").strip()
        if s:
            merged[s] = float(item.get("ai_score") or 0)
    for r in rows:
        s = str(r.get("slug") or "").strip()
        if s:
            merged[s] = float(r.get("ai_score") or 0)
    ordered = sorted(merged.keys(), key=lambda slug: (-merged[slug], slug))
    n = len(ordered)
    slug_level: dict[str, str] = {}
    for k, slug in enumerate(ordered):
        frac = 0.0 if n == 1 else k / n
        slug_level[slug] = assessment_level_from_fraction_from_top(frac)
    for r in rows:
        s = str(r.get("slug") or "").strip()
        if s:
            r["assessment_level"] = slug_level.get(s, "MODERATE")


def build_assessment_level(rating: float, score: float) -> str:
    """Legacy fixed thresholds (rating + ai_score). Prefer percentile helpers for DB."""
    r = float(rating) if rating is not None else 0.0
    s = float(score) if score is not None else 0.0
    if s >= 86 and r >= 4.71:
        return "EXCELLENT"
    if s >= 70 and r >= 4.36:
        return "GOOD"
    if s >= 53 and r >= 3.98:
        return "MODERATE"
    if r < 4.0:
        return "LOW"
    return "RISKY"


def freshness_heuristic(review_count: int, reviews_array: list[Any] | None) -> float:
    n = max(0, int(review_count or 0))
    recent = 0
    total_with_time = 0
    if isinstance(reviews_array, list):
        now_ms = time.time() * 1000
        max_age_ms = 120 * 24 * 60 * 60 * 1000
        for rv in reviews_array:
            if not isinstance(rv, dict):
                continue
            pt = rv.get("publishTime") or rv.get("publish_time")
            if not pt:
                continue
            total_with_time += 1
            try:
                t_ms = _parse_time_ms(str(pt))
            except (ValueError, OSError, OverflowError):
                continue
            if math.isfinite(t_ms) and now_ms - t_ms <= max_age_ms:
                recent += 1
    if total_with_time >= 3:
        ratio = recent / total_with_time
        return round((0.64 + ratio * 0.34) * 1000) / 1000
    return round((0.58 + min(1.0, n / 500.0) * 0.36) * 1000) / 1000


def _parse_time_ms(iso: str) -> float:
    from datetime import datetime

    s = iso.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    return dt.timestamp() * 1000


def sentiment_fallback_from_rating(rating: float) -> float:
    r = float(rating) if rating is not None else 0.0
    r = min(5.0, max(1.0, r))
    linear = (r - 1.0) / 4.0
    return round(min(0.98, max(0.52, linear)) * 1000) / 1000


def clamp01(x: float) -> float:
    if not math.isfinite(x):
        return 0.72
    return min(1.0, max(0.0, x))


def histogram_from_record(rec: Mapping[str, Any]) -> dict[int, int]:
    if isinstance(rec.get("reviews"), list):
        return count_stars_from_review_list(rec["reviews"])
    raw_hist = rec.get("star_histogram") or rec.get("starHistogram") or rec.get("histogram")
    normalized = normalize_histogram_input(raw_hist)
    return normalized if normalized is not None else empty_histogram()


def compute_leaderboard_metrics(
    rating: float,
    review_count: int,
    reviews: list[Any] | None,
    star_histogram_raw: Any,
) -> dict[str, Any]:
    """Build metrics from one logical source row (rating, n, optional reviews / histogram keys on parent)."""
    rec: dict[str, Any] = {
        "reviews": reviews,
        "star_histogram": star_histogram_raw,
    }
    hist = histogram_from_record(rec)
    hist_total = sum_histogram(hist)
    incomplete = hist_total > 0 and review_count > 0 and hist_total < review_count
    if hist_total > 0:
        sentiment_p = sentiment_from_review_histogram(hist, review_count or hist_total)
        if incomplete:
            blend = clamp01((sentiment_p + sentiment_fallback_from_rating(rating)) / 2)
            sentiment_p = round(blend * 1000) / 1000
    else:
        sentiment_p = sentiment_fallback_from_rating(rating)

    reviews_arr = reviews if isinstance(reviews, list) else []
    freshness_f = freshness_heuristic(review_count, reviews_arr)
    ai_score = calc_ai_score(rating, review_count, sentiment_p, freshness_f)
    level = build_assessment_level(rating, ai_score)
    return {
        "sentiment_p": round(sentiment_p * 1000) / 1000,
        "freshness_f": freshness_f,
        "ai_score": ai_score,
        "assessment_level": level,
    }


def ensure_slug(raw_slug: str | None, name: str, index: int) -> str:
    trimmed = (raw_slug or "").strip().lower()
    if trimmed and SLUG_RE.fullmatch(trimmed):
        return trimmed
    base = re.sub(r"[^a-z0-9]+", "-", (name or "salon").lower()).strip("-")[:40] or "salon"
    candidate = f"{base}-{index}"
    if SLUG_RE.fullmatch(candidate):
        return candidate
    return f"salon-{index}"
