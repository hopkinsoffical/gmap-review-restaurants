"""
Mirror lib/server/restr-leaderboard-scoring.js for restr_ai_leaderboard ingestion.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Mapping, Optional

from leaderboard_scoring import (
    assign_assessment_levels_by_ai_score_percentile,
    freshness_heuristic,
    sentiment_from_review_histogram,
)

VOLUME_PLATEAU = 2000
RATING_FLOOR = 3.5


def _clamp01(x: Any, fallback: float = 0.8) -> float:
    try:
        n = float(x)
    except (TypeError, ValueError):
        return fallback
    return max(0.0, min(1.0, n))


def _round1(v: float) -> float:
    return round(max(0.0, min(100.0, float(v))), 1)


def calc_restr_ai_score(
    rating: float,
    review_count: int,
    sentiment_p: float,
    freshness_f: float,
    local_seo_score: float = 0.0,
    conversion_score: float = 0.0,
) -> float:
    r = max(1.0, min(5.0, float(rating or 0)))
    n = max(0, int(review_count or 0))
    pn = _clamp01(sentiment_p, 0.72)
    fn = _clamp01(freshness_f, 0.7)
    local_seo = max(0.0, min(100.0, float(local_seo_score or 0)))
    conversion = max(0.0, min(100.0, float(conversion_score or 0)))

    rating_norm = max(0.0, min(1.0, (r - RATING_FLOOR) / (5.0 - RATING_FLOOR)))
    volume_norm = min(1.0, math.log10(n + 1) / math.log10(VOLUME_PLATEAU))
    visibility_norm = (local_seo * 0.55 + conversion * 0.45) / 100.0

    blend = (
        rating_norm * 0.24
        + volume_norm * 0.22
        + pn * 0.16
        + fn * 0.10
        + visibility_norm * 0.28
    )
    conf = 1.0 - math.exp(-n / 65.0)
    prior = 0.5
    adjusted = prior + (blend - prior) * (0.34 + 0.66 * conf)
    return _round1(adjusted * 100.0)


def restr_dimension_scores_from_signals(signals: Mapping[str, Any]) -> Dict[str, float]:
    rating = float(signals.get("rating") or 0)
    review_count = max(0, int(signals.get("reviewCount") or signals.get("review_count") or 0))
    sentiment_p = _clamp01(signals.get("sentimentP") or signals.get("sentiment_p"), 0.8)
    freshness_f = _clamp01(signals.get("freshnessF") or signals.get("freshness_f"), 0.75)

    def has_val(v: Any) -> bool:
        return v is not None and str(v).strip() != ""

    opening = signals.get("openingHours") or signals.get("opening_hours")
    has_hours = bool(opening) and (
        (isinstance(opening, list) and len(opening) > 0)
        or (isinstance(opening, dict) and len(opening) > 0)
    )
    categories = signals.get("categories")
    has_categories = (isinstance(categories, list) and len(categories) > 0) or has_val(categories)

    rating_score = _round1(max(0.0, ((rating - RATING_FLOOR) / (5.0 - RATING_FLOOR)) * 100.0))
    review_score = _round1((math.log10(review_count + 1) / math.log10(VOLUME_PLATEAU)) * 100.0)
    sentiment_score = _round1(sentiment_p * 100.0)
    recency_score = _round1(freshness_f * 100.0)

    local_seo_score = _round1(
        (22 if has_val(signals.get("menuUrl") or signals.get("menu_url")) else 0)
        + (14 if has_val(signals.get("website")) else 0)
        + (16 if has_hours else 0)
        + (10 if has_val(signals.get("imageUrl") or signals.get("image_url")) else 0)
        + (8 if has_categories else 0)
        + (10 if has_val(signals.get("price")) else 0)
        + (8 if has_val(signals.get("address")) else 0)
        + (12 if has_val(signals.get("placeId") or signals.get("place_id")) else 0)
    )

    conversion_score = _round1(
        rating_score * 0.18
        + review_score * 0.14
        + (22 if has_val(signals.get("phone")) else 0)
        + (18 if has_val(signals.get("menuUrl") or signals.get("menu_url")) else 0)
        + (12 if signals.get("reservable") else 0)
        + (10 if (signals.get("delivery") or signals.get("takeout")) else 0)
        + (6 if signals.get("dineIn") or signals.get("dine_in") else 0)
        + (10 if has_val(signals.get("placeId") or signals.get("place_id")) else 0)
    )

    return {
        "dim_reviews_score": review_score,
        "dim_rating_score": rating_score,
        "dim_sentiment_score": sentiment_score,
        "dim_recency_score": recency_score,
        "dim_local_seo_score": local_seo_score,
        "dim_conversion_score": conversion_score,
    }
