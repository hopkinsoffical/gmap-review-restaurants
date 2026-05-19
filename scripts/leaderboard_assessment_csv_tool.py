#!/usr/bin/env python3
"""
Export / recalc / apply assessment_level (risk band) for public.salon_ai_leaderboard.

DB column name: assessment_level (values like EXCELLENT, GOOD, MODERATE, LOW, RISKY).

Prerequisites (repo root):
  pip install -r pipelines/requirements.txt

Env (export + apply): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local or .env

Typical flow:
  1) python3 scripts/leaderboard_assessment_csv_tool.py export -o data/leaderboard_for_levels.csv
  2) python3 scripts/leaderboard_assessment_csv_tool.py recalc -i data/leaderboard_for_levels.csv \\
       --mode strict -o data/leaderboard_levels_preview.csv --sql data/leaderboard_levels_updates.sql
  3) Supabase SQL Editor: paste contents of leaderboard_levels_updates.sql  (or:)
     python3 scripts/leaderboard_assessment_csv_tool.py apply -i data/leaderboard_levels_updates.csv

Tune strict thresholds in STRICT_RULES below (or use --mode quantile).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
_PIPE = ROOT / "pipelines"
if str(_PIPE) not in sys.path:
    sys.path.insert(0, str(_PIPE))

from dotenv import load_dotenv  # noqa: E402

import leaderboard_scoring as lbs  # noqa: E402

# ---------------------------------------------------------------------------
# Stricter than lib/server/leaderboard-scoring.js (s>=85 & r>=4.7 → EXCELLENT).
# Edit these to taste; higher score/rating/reviews = fewer EXCELLENT.
# ---------------------------------------------------------------------------
STRICT_RULES: list[dict[str, Any]] = [
    # (label, min_score, min_rating, min_reviews) — first match wins, top to bottom
    {"level": "EXCELLENT", "min_score": 92.0, "min_rating": 4.82, "min_reviews": 120},
    {"level": "EXCELLENT", "min_score": 89.0, "min_rating": 4.78, "min_reviews": 60},
    {"level": "EXCELLENT", "min_score": 86.0, "min_rating": 4.75, "min_reviews": 250},
    {"level": "GOOD", "min_score": 74.0, "min_rating": 4.52, "min_reviews": 0},
    {"level": "MODERATE", "min_score": 54.0, "min_rating": 4.05, "min_reviews": 0},
    {"level": "LOW", "max_rating": 4.0, "min_reviews": 0},
    {"level": "RISKY", "min_score": 0.0, "min_rating": 0.0, "min_reviews": 0},
]


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def _rest_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _fetch_page(
    base: str,
    service_key: str,
    select: str,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    q = urllib.parse.urlencode(
        {
            "select": select,
            "is_listed": "eq.true",
            "order": "updated_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        }
    )
    url = f"{base.rstrip('/')}/rest/v1/salon_ai_leaderboard?{q}"
    req = urllib.request.Request(url, headers=_rest_headers(service_key), method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body) if body.strip() else []


def cmd_export(args: argparse.Namespace) -> int:
    _load_env()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    select = (
        "id,slug,name,rating,review_count,ai_score,sentiment_p,freshness_f,assessment_level,updated_at"
    )
    page = max(50, min(1000, int(args.page_size)))
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        chunk = _fetch_page(url, key, select, offset, page)
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
        print(f"  fetched {len(rows)} rows...", file=sys.stderr)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id",
        "slug",
        "name",
        "rating",
        "review_count",
        "ai_score",
        "sentiment_p",
        "freshness_f",
        "assessment_level",
        "updated_at",
    ]
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})

    print(f"Wrote {len(rows)} rows to {out_path}")
    return 0


def _float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _int(x: Any, default: int = 0) -> int:
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return default


def assessment_level_strict(rating: float, score: float, reviews: int) -> str:
    r = _float(rating)
    s = _float(score)
    n = max(0, _int(reviews))
    for rule in STRICT_RULES:
        lvl = str(rule["level"])
        if "max_rating" in rule:
            if r < _float(rule["max_rating"], 4.0):
                return lvl
            continue
        ms = _float(rule.get("min_score"), 0)
        mr = _float(rule.get("min_rating"), 0)
        mn = _int(rule.get("min_reviews"), 0)
        if s >= ms and r >= mr and n >= mn:
            return lvl
    return "RISKY"


def assessment_level_quantile(
    rows: list[dict[str, Any]],
    excellent_frac: float,
    min_rating_for_tier: float,
    min_reviews_excellent: int,
) -> list[str]:
    """EXCELLENT only for top `excellent_frac` by ai_score (among rating>=min_rating_for_tier) with min reviews; others never EXCELLENT (strict base capped at GOOD)."""
    scored: list[tuple[float, int]] = []
    for i, row in enumerate(rows):
        s = _float(row.get("ai_score"))
        r = _float(row.get("rating"))
        if r >= min_rating_for_tier:
            scored.append((s, i))
    scored.sort(key=lambda t: t[0], reverse=True)
    k = max(0, int(round(len(scored) * excellent_frac)))
    excellent_idx = {idx for _, idx in scored[:k]}

    out: list[str] = []
    for i, row in enumerate(rows):
        r = _float(row.get("rating"))
        s = _float(row.get("ai_score"))
        n = _int(row.get("review_count"))
        base = assessment_level_strict(r, s, n)
        if base == "EXCELLENT":
            base = "GOOD"
        if i in excellent_idx and n >= min_reviews_excellent:
            out.append("EXCELLENT")
        else:
            out.append(base)
    return out


def cmd_recalc(args: argparse.Namespace) -> int:
    in_path = Path(args.input)
    if not in_path.is_file():
        print(f"Missing input file: {in_path}", file=sys.stderr)
        return 1

    with in_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    mode = str(args.mode).lower().strip()
    if mode == "legacy":
        new_levels = [
            lbs.build_assessment_level(_float(r.get("rating")), _float(r.get("ai_score"))) for r in rows
        ]
    elif mode == "strict":
        new_levels = [
            assessment_level_strict(
                _float(r.get("rating")),
                _float(r.get("ai_score")),
                _int(r.get("review_count")),
            )
            for r in rows
        ]
    elif mode == "quantile":
        new_levels = assessment_level_quantile(
            rows,
            excellent_frac=float(args.excellent_frac),
            min_rating_for_tier=float(args.quantile_min_rating),
            min_reviews_excellent=int(args.quantile_min_reviews),
        )
    else:
        print("Unknown --mode (legacy|strict|quantile)", file=sys.stderr)
        return 1

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else []
    for extra in ("assessment_level_old", "assessment_level_new", "level_changed"):
        if extra not in fieldnames:
            fieldnames.append(extra)

    updates: list[tuple[str, str, str]] = []
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row, nl in zip(rows, new_levels):
            old = str(row.get("assessment_level") or "").strip().upper()
            row_out = dict(row)
            row_out["assessment_level_old"] = old
            row_out["assessment_level_new"] = nl
            row_out["level_changed"] = "1" if nl != old else "0"
            w.writerow(row_out)
            if nl != old:
                rid = str(row.get("id") or "").strip()
                if rid:
                    updates.append((rid, old, nl))

    sql_path = Path(args.sql) if args.sql else None
    if sql_path:
        sql_path.parent.mkdir(parents=True, exist_ok=True)
        with sql_path.open("w", encoding="utf-8") as sf:
            sf.write("-- Generated by leaderboard_assessment_csv_tool.py recalc\n")
            sf.write("begin;\n")
            for rid, _old, nl in updates:
                esc = nl.replace("'", "''")
                sf.write(
                    f"update public.salon_ai_leaderboard set assessment_level = '{esc}' "
                    f"where id = '{rid}';\n"
                )
            sf.write("commit;\n")
        print(f"Wrote SQL updates ({len(updates)} statements) to {sql_path}")

    # minimal CSV for apply: id, assessment_level
    upd_csv = out_path.with_name(out_path.stem + "_updates_only.csv")
    with upd_csv.open("w", newline="", encoding="utf-8") as f:
        uw = csv.DictWriter(f, fieldnames=["id", "assessment_level"])
        uw.writeheader()
        for rid, _o, nl in updates:
            uw.writerow({"id": rid, "assessment_level": nl})
    print(f"Wrote preview ({len(rows)} rows) to {out_path}")
    print(f"Wrote {len(updates)} changed rows to {upd_csv}")
    return 0


def cmd_apply(args: argparse.Namespace) -> int:
    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        print("Install: pip install -r pipelines/requirements.txt", file=sys.stderr)
        return 1

    _load_env()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    in_path = Path(args.input)
    with in_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        pairs = [(str(r["id"]).strip(), str(r["assessment_level"]).strip().upper()) for r in reader if r.get("id")]

    client = create_client(url, key)
    ok = 0
    for rid, lvl in pairs:
        client.table("salon_ai_leaderboard").update({"assessment_level": lvl}).eq("id", rid).execute()
        ok += 1
        if ok % 50 == 0:
            print(f"  applied {ok}/{len(pairs)}...", file=sys.stderr)

    print(f"Updated {ok} rows via Supabase API.")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Leaderboard assessment_level CSV tool")
    sub = p.add_subparsers(dest="cmd", required=True)

    pe = sub.add_parser("export", help="Download listed salons to CSV (REST, service role)")
    pe.add_argument("-o", "--output", default="data/leaderboard_for_levels.csv")
    pe.add_argument("--page-size", type=int, default=1000)
    pe.set_defaults(func=cmd_export)

    pr = sub.add_parser("recalc", help="Read CSV, write new levels + SQL + updates_only CSV")
    pr.add_argument("-i", "--input", required=True)
    pr.add_argument("-o", "--output", default="data/leaderboard_levels_preview.csv")
    pr.add_argument("--sql", default="data/leaderboard_levels_updates.sql")
    pr.add_argument(
        "--mode",
        choices=("strict", "legacy", "quantile"),
        default="strict",
        help="strict=tunable STRICT_RULES; legacy=current JS/Python formula; quantile=cap EXCELLENT share",
    )
    pr.add_argument("--excellent-frac", dest="excellent_frac", type=float, default=0.12)
    pr.add_argument("--quantile-min-rating", dest="quantile_min_rating", type=float, default=4.55)
    pr.add_argument("--quantile-min-reviews", dest="quantile_min_reviews", type=int, default=25)
    pr.set_defaults(func=cmd_recalc)

    pa = sub.add_parser("apply", help="Apply updates_only.csv via Supabase client (service role)")
    pa.add_argument("-i", "--input", required=True, help="CSV with columns: id, assessment_level")
    pa.set_defaults(func=cmd_apply)

    args = p.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
