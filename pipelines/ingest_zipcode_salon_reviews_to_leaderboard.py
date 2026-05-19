#!/usr/bin/env python3
"""
Aggregate zipcode-scrape CSVs (salon_reviews_*.csv) and insert new salons into
public.salon_ai_leaderboard (append-only), skipping rows already present on
salon_ai_leaderboard_latest for the same state (by place_id / slug).

No review body text is written to Supabase—only listing/overview fields, aggregate
rating and review count (including list-only rows with maps_review_count), and scores
derived from ratings/counts/timestamps—not full scraped reviews.

Typical use after one ZIP finishes (from parallel_zipcode_salon_google_reviews.py):
  python3 pipelines/ingest_zipcode_salon_reviews_to_leaderboard.py \\
    --output-dir data/me_zipcode_salon_reviews \\
    --single-target "04346 ME"

Batch one state (filename suffix must match, e.g. *_me.csv):
  python3 pipelines/ingest_zipcode_salon_reviews_to_leaderboard.py \\
    --output-dir data/me_zipcode_salon_reviews \\
    --state ME --all-csvs

Batch every state found under one or more directories (suffix _<st>.csv):
  python3 pipelines/ingest_zipcode_salon_reviews_to_leaderboard.py \\
    --output-dir data/me_zipcode_salon_reviews \\
    --output-dir data/ma_zipcode_salon_reviews \\
    --all-csvs
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
if str(_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(_PIPELINES_DIR))

from dotenv import load_dotenv  # noqa: E402

import ingest_salon_ai_leaderboard as ing  # noqa: E402

INSTAGRAM_RE = re.compile(
    r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?(?:\?|#|$)",
    re.IGNORECASE,
)

# Matches `state` column in data/us_zipcode_population_2020.csv (full state names).
STATE_CODE_TO_FULL: dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
}

_CSV_STATE_SUFFIX_RE = re.compile(r"^salon_reviews_.*_([a-z]{2})\.csv$", re.IGNORECASE)


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def _slug_place(place: str) -> str:
    s = re.sub(r"[^\w\s-]", "", place)
    s = re.sub(r"[-\s]+", "_", s.strip()).lower()
    return (s[:180] or "place").strip("_")


def _stable_slug(name: str, stable_key: str) -> str:
    h = hashlib.sha256((stable_key or name).encode("utf-8")).hexdigest()[:10]
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:28] or "salon"
    cand = f"{base}-{h}"
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", cand):
        return cand
    return f"salon-{h}"


def _extract_place_id_from_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    m = re.search(r"!1s([^:!]+):0x", u)
    if m:
        return m.group(1)
    m2 = re.search(r"/place/([^/?]+)", u)
    if m2:
        return m2.group(1)
    return ""


def _normalize_instagram(url: str) -> tuple[str, str] | None:
    m = INSTAGRAM_RE.search(url or "")
    if not m:
        return None
    handle = (m.group(1) or "").strip()
    if not handle:
        return None
    return f"https://www.instagram.com/{handle}/", handle


def _read_reviews_csv(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({k: (v or "").strip() for k, v in r.items()})
    return rows


def _normalize_town(raw_search_city: str, state_code: str) -> str:
    t = re.sub(
        r"^(nail salon|hair salon|beauty salon|day spa|spa|salon)\s+",
        "",
        raw_search_city.strip(),
        flags=re.I,
    )
    t = re.sub(rf"\s+{re.escape(state_code)}$", "", t, flags=re.I).strip()
    return t or "Unknown"


def _category_from_search_city(raw_search_city: str) -> str:
    s = (raw_search_city or "").lower()
    if "day spa" in s:
        return "day spa"
    if re.search(r"\bspa\b", s):
        return "spa"
    if "nail salon" in s:
        return "nail salon"
    if "hair salon" in s:
        return "hair salon"
    if "beauty salon" in s:
        return "beauty salon"
    return "salon"


def load_county_by_zipcode(csv_path: Path, state_code: str) -> dict[str, str]:
    full = STATE_CODE_TO_FULL.get(state_code.upper())
    if not full or not csv_path.is_file():
        return {}
    out: dict[str, str] = {}
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row.get("state") or "").strip() != full:
                continue
            z = str(row.get("zipcode") or row.get("zcta5") or "").strip().zfill(5)
            c = (row.get("county") or "").strip()
            if z and c:
                out[z] = c
    return out


def infer_state_code_from_salon_csv_name(path: Path) -> str | None:
    """Parse trailing _<st> before .csv (e.g. salon_reviews_04346_me.csv -> ME)."""
    m = _CSV_STATE_SUFFIX_RE.match(path.name)
    return m.group(1).upper() if m else None


def _normalize_output_dirs(raw_dirs: list[Path]) -> list[Path]:
    out: list[Path] = []
    for p in raw_dirs:
        resolved = p if p.is_absolute() else ROOT / p
        out.append(resolved)
    return out


def aggregate_from_csv_paths(
    csv_paths: list[Path],
    state_code: str,
    county_by_zip: dict[str, str],
) -> list[dict[str, Any]]:
    state_code = state_code.upper()
    grouped: dict[str, dict[str, Any]] = {}
    for csv_path in csv_paths:
        if not csv_path.is_file():
            continue
        for r in _read_reviews_csv(csv_path):
            google_url = r.get("salon_google_url", "")
            if not google_url:
                continue
            key = google_url
            town = _normalize_town(r.get("search_city", ""), state_code)
            zip_val = ""
            if re.fullmatch(r"\d{5}", town):
                zip_val = town
            county = county_by_zip.get(zip_val, "Unknown") if zip_val else "Unknown"
            rating_val = None
            try:
                rating_val = float(r["rating"]) if r.get("rating") else None
            except ValueError:
                rating_val = None
            instagram = _normalize_instagram(r.get("salon_instagram", ""))
            raw_mrc = (r.get("maps_review_count") or "").strip()
            listing_snapshot = bool(raw_mrc) or (r.get("reviewer_name") or "").strip() == "(listing)"
            item = grouped.setdefault(
                key,
                {
                    "name": r.get("salon_name", ""),
                    "address": r.get("salon_address", ""),
                    "phone": r.get("salon_phone", ""),
                    "website": r.get("salon_website", ""),
                    "town": town,
                    "county": county,
                    "state": state_code,
                    "category": _category_from_search_city(r.get("search_city", "")),
                    "place_id": _extract_place_id_from_url(google_url),
                    "google_place_id": _extract_place_id_from_url(google_url),
                    "instagram_url": instagram[0] if instagram else "",
                    "instagram_handle": instagram[1] if instagram else "",
                    "instagram_source": "maps_overview" if instagram else "",
                    "reviews": [],
                    "_rating_sum": 0.0,
                    "_rating_n": 0,
                    "_review_count": 0,
                },
            )
            if zip_val:
                item["zipcode"] = zip_val
                c2 = county_by_zip.get(zip_val, "Unknown")
                if item.get("county") == "Unknown" and c2 != "Unknown":
                    item["county"] = c2
            if listing_snapshot and raw_mrc != "":
                try:
                    cnt = int(float(raw_mrc.replace(",", "").replace(" ", "")))
                except ValueError:
                    cnt = 0
                item["_review_count"] = max(int(item["_review_count"]), cnt)
                if rating_val is not None:
                    item["_rating_n"] = 1
                    item["_rating_sum"] = float(rating_val)
                    if not item["reviews"]:
                        item["reviews"].append(
                            {"rating": rating_val, "publishTime": r.get("published_at", "") or None},
                        )
            elif listing_snapshot:
                item["_review_count"] = max(int(item["_review_count"]), 0)
                if rating_val is not None:
                    item["_rating_n"] = 1
                    item["_rating_sum"] = float(rating_val)
                    if not item["reviews"]:
                        item["reviews"].append(
                            {"rating": rating_val, "publishTime": r.get("published_at", "") or None},
                        )
            else:
                item["_review_count"] += 1
                if rating_val is not None:
                    item["_rating_sum"] += rating_val
                    item["_rating_n"] += 1
                    item["reviews"].append(
                        {"rating": rating_val, "publishTime": r.get("published_at", "") or None},
                    )
            if not item.get("website"):
                item["website"] = r.get("salon_website", "")
            if not item.get("phone"):
                item["phone"] = r.get("salon_phone", "")
            if instagram and not item.get("instagram_url"):
                item["instagram_url"] = instagram[0]
                item["instagram_handle"] = instagram[1]
                item["instagram_source"] = "maps_overview"

    out: list[dict[str, Any]] = []
    for google_url, item in grouped.items():
        n = int(item.pop("_rating_n"))
        s = float(item.pop("_rating_sum"))
        rc = int(item.pop("_review_count"))
        rating = (s / n) if n > 0 else 0.0
        stable_key = item.get("place_id") or google_url
        item["slug"] = _stable_slug(item.get("name", ""), stable_key)
        item["rating"] = round(rating, 2)
        item["review_count"] = rc
        item["is_listed"] = True
        if "zipcode" not in item:
            item["zipcode"] = ""
        out.append(item)
    return out


def _state_from_target(target: str) -> str:
    parts = target.strip().split()
    if len(parts) >= 2 and len(parts[-1]) == 2 and parts[-1].isalpha():
        return parts[-1].upper()
    raise ValueError(f"Cannot infer state from target (expected e.g. '04101 ME'): {target!r}")


def _fetch_existing_keys(state: str) -> tuple[set[str], set[str]]:
    from supabase import create_client

    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    client = create_client(url, key)
    place_ids: set[str] = set()
    slugs: set[str] = set()
    page_size = 1000
    offset = 0
    while True:
        res = (
            client.table("salon_ai_leaderboard_latest")
            .select("place_id,slug")
            .eq("state", state)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = res.data or []
        for row in rows:
            pid = (row.get("place_id") or "").strip()
            if pid:
                place_ids.add(pid)
            sg = (row.get("slug") or "").strip()
            if sg:
                slugs.add(sg)
        if len(rows) < page_size:
            break
        offset += page_size
    return place_ids, slugs


def _filter_new_only(
    records: list[dict[str, Any]],
    existing_place_ids: set[str],
    existing_slugs: set[str],
) -> list[dict[str, Any]]:
    new_rows: list[dict[str, Any]] = []
    for rec in records:
        pid = (rec.get("place_id") or rec.get("google_place_id") or "").strip()
        slug = (rec.get("slug") or "").strip()
        if pid and pid in existing_place_ids:
            continue
        if slug and slug in existing_slugs:
            continue
        new_rows.append(rec)
    return new_rows


def _run_ingest_for_state(
    state: str,
    csv_paths: list[Path],
    zip_csv: Path | None,
    *,
    chunk_size: int,
    re_ingest_existing: bool,
    dry_run: bool,
    json_out: Path | None,
) -> int:
    """Insert new leaderboard rows for one state; returns row count inserted."""
    county = load_county_by_zipcode(zip_csv, state) if zip_csv and zip_csv.is_file() else {}
    paths_exist = [p for p in csv_paths if p.is_file()]
    if not paths_exist:
        print(f"[{state}] No CSV files on disk ({len(csv_paths)} path(s)).", flush=True)
        return 0
    records = aggregate_from_csv_paths(paths_exist, state, county)
    print(
        f"[{state}] Aggregated {len(records)} unique salon/spa row(s) from {len(paths_exist)} CSV file(s).",
        flush=True,
    )
    to_ingest = records
    if not re_ingest_existing:
        existing_p, existing_s = _fetch_existing_keys(state)
        to_ingest = _filter_new_only(records, existing_p, existing_s)
        print(
            f"[{state}] Skipping {len(records) - len(to_ingest)} already on salon_ai_leaderboard_latest; "
            f"{len(to_ingest)} new row(s).",
            flush=True,
        )
    if json_out:
        out_p = json_out if json_out.is_absolute() else ROOT / json_out
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(to_ingest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{state}] Wrote {out_p}", flush=True)
    if dry_run:
        print(f"[{state}] Dry run: skip Supabase insert.", flush=True)
        return 0
    if not to_ingest:
        print(f"[{state}] Nothing to insert.", flush=True)
        return 0
    chunk = max(1, min(500, int(chunk_size)))
    n, slugs = ing.ingest(to_ingest, chunk_size=chunk)
    print(f"[{state}] Ingested {n} row(s). First slugs: {', '.join(slugs[:10])}", flush=True)
    return n


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest zipcode salon CSV rows into salon_ai_leaderboard (new rows only).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        action="append",
        metavar="DIR",
        required=True,
        help="Directory containing salon_reviews_*.csv (repeat for multiple state folders).",
    )
    parser.add_argument(
        "--state",
        type=str,
        default="",
        help=(
            "Two-letter state code. With --all-csvs, if set, only files named salon_reviews_*_<st>.csv "
            "for this state; if omitted, every state suffix found under --output-dir is ingested."
        ),
    )
    parser.add_argument(
        "--single-target",
        type=str,
        default="",
        help='One scrape target, e.g. "04346 ME" — ingest that ZIP’s CSV only.',
    )
    parser.add_argument(
        "--all-csvs",
        action="store_true",
        help="Scan --output-dir path(s) for salon_reviews_*.csv; use --state or omit for all states.",
    )
    parser.add_argument(
        "--zip-population-csv",
        type=Path,
        default=ROOT / "data" / "us_zipcode_population_2020.csv",
        help="ZCTA CSV for county lookup by zipcode (optional).",
    )
    parser.add_argument("--chunk-size", type=int, default=50)
    parser.add_argument(
        "--re-ingest-existing",
        action="store_true",
        help="Do not skip salons already on salon_ai_leaderboard_latest.",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="If set, write aggregated new-only records to this JSON path.",
    )
    args = parser.parse_args()

    output_dirs = _normalize_output_dirs(args.output_dir)
    for d in output_dirs:
        if not d.is_dir():
            print(f"Output directory not found: {d}", file=sys.stderr)
            sys.exit(1)

    zip_csv = args.zip_population_csv
    if zip_csv and not zip_csv.is_absolute():
        zip_csv = ROOT / zip_csv
    if zip_csv and not zip_csv.is_file():
        zip_csv = None

    state_opt = (args.state or "").strip().upper()

    if args.single_target:
        inferred = _state_from_target(args.single_target)
        if state_opt and state_opt != inferred:
            print(
                f"Warning: --state {state_opt} disagrees with --single-target; using {inferred}.",
                file=sys.stderr,
            )
        state = inferred
        slug = _slug_place(args.single_target.strip())
        csv_paths = [output_dirs[0] / f"salon_reviews_{slug}.csv"]
        _load_env()
        ing._load_env()
        _run_ingest_for_state(
            state,
            csv_paths,
            zip_csv,
            chunk_size=args.chunk_size,
            re_ingest_existing=bool(args.re_ingest_existing),
            dry_run=bool(args.dry_run),
            json_out=args.json_out,
        )
        return

    if not args.all_csvs:
        print("Provide --single-target or --all-csvs.", file=sys.stderr)
        sys.exit(1)

    all_csv: list[Path] = []
    for d in output_dirs:
        all_csv.extend(sorted(d.glob("salon_reviews_*.csv")))

    if state_opt:
        if len(state_opt) != 2 or not state_opt.isalpha():
            print("--state must be a two-letter code (e.g. ME).", file=sys.stderr)
            sys.exit(2)
        csv_paths = [p for p in all_csv if infer_state_code_from_salon_csv_name(p) == state_opt]
        if not csv_paths:
            print(f"No salon_reviews_*_{state_opt.lower()}.csv files under given directories.", file=sys.stderr)
            sys.exit(0)
        _load_env()
        ing._load_env()
        _run_ingest_for_state(
            state_opt,
            csv_paths,
            zip_csv,
            chunk_size=args.chunk_size,
            re_ingest_existing=bool(args.re_ingest_existing),
            dry_run=bool(args.dry_run),
            json_out=args.json_out,
        )
        return

    by_state: dict[str, list[Path]] = {}
    skipped = 0
    for p in all_csv:
        st = infer_state_code_from_salon_csv_name(p)
        if not st:
            skipped += 1
            continue
        by_state.setdefault(st, []).append(p)
    if skipped:
        print(
            f"Skipped {skipped} file(s) not matching salon_reviews_*_<st>.csv (two-letter state suffix).",
            flush=True,
        )
    if not by_state:
        print("No CSV files with a parseable state suffix.", file=sys.stderr)
        sys.exit(0)

    _load_env()
    ing._load_env()
    if args.json_out and len(by_state) > 1:
        print("Note: --json-out ignored when ingesting multiple states.", flush=True)
    for st in sorted(by_state.keys()):
        jo = args.json_out
        if jo and len(by_state) == 1:
            pass
        elif jo and len(by_state) > 1:
            jo = None
        _run_ingest_for_state(
            st,
            by_state[st],
            zip_csv,
            chunk_size=args.chunk_size,
            re_ingest_existing=bool(args.re_ingest_existing),
            dry_run=bool(args.dry_run),
            json_out=jo,
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
