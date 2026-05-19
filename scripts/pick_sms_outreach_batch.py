#!/usr/bin/env python3
"""
Pick N NJ salons for SMS outreach (mobile lines only).

Canonical phone pool workflow:
  1) salon_ai_leaderboard (via view salon_ai_leaderboard_latest): source slug, name, phone, address.
  2) Twilio Line Type Intelligence (in scripts/sync_salon_nj_mobile_phones.py): classify mobile/wireless.
  3) public.salon_nj_mobile_phones: upsert verified mobile rows (apply sql/029_salon_nj_mobile_phones.sql).
  4) This script with --prefer-table: read mobile + name + slug from that table, write sms_body (Ryan format).

Fallback (no --prefer-table, or empty table when not required): intersect NJ slugs from the view with
data/leaderboard_phone_sms.csv (Twilio-classified export from leaderboard_phone_sms_lookup.py).

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage:
  python3 scripts/pick_sms_outreach_batch.py -o data/sms_outreach_50.csv --limit 50
  python3 scripts/pick_sms_outreach_batch.py --include-full-state-name --seed 42 --limit 50
  python3 scripts/pick_sms_outreach_batch.py -o data/next.csv --limit 50 \
    --exclude-slugs-from data/twilio_sms_sent_log.csv \
    --exclude-slugs-from data/sms_outreach_50.csv

Compliance: ensure you have consent / legal basis before sending marketing SMS (e.g. TCPA opt-in).
"""

from __future__ import annotations

import argparse
import csv
import os
import random
import sys
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]

from dotenv import load_dotenv  # noqa: E402


def _load_env() -> None:
    load_dotenv(_ROOT / ".env.local")
    load_dotenv(_ROOT / ".env")


def render_outreach_sms_body(salon_display_name: str, slug: str) -> str:
    """
    Outreach SMS: Ryan intro + Google visibility offer; personalize venue name when known.
    slug is retained for API compatibility; free report link is sent after YES reply (inbound flow).
    """
    _ = slug  # optional future deep links; primary CTA is YES for free link
    name = (salon_display_name or "").strip()
    venue = name if name else "your salon"
    return (
        "Hi, this is Ryan from RankMySalon. I help salons improve visibility on Google Maps, reviews, and local search.\n"
        "A few small improvements that most salon owners overlook can help improve your Google rank.\n"
        f"Would you like a free Google Visibility Checkup for {venue}? It shows your review presence, local visibility, "
        "and quick wins to attract more bookings.\n"
        'Reply "YES" for the free link. Reply STOP to opt out.'
    )


def _fetch_slugs_by_state(client: Any, state_value: str) -> set[str]:
    out: set[str] = set()
    page = 0
    page_size = 1000
    while True:
        r = (
            client.table("salon_ai_leaderboard_latest")
            .select("slug")
            .eq("state", state_value)
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        batch = r.data or []
        for row in batch:
            s = str(row.get("slug") or "").strip()
            if s:
                out.add(s)
        if len(batch) < page_size:
            break
        page += 1
    return out


def _fetch_nj_slugs(client: Any, state_eq: str, include_new_jersey_name: bool) -> set[str]:
    out = _fetch_slugs_by_state(client, state_eq)
    if include_new_jersey_name:
        out |= _fetch_slugs_by_state(client, "New Jersey")
    return out


def _mobile_slugs_from_csv(csv_path: Path, nj_slugs: set[str]) -> list[str]:
    """One row per slug: first occurrence wins; only mobile/wireless and in nj_slugs."""
    seen: set[str] = set()
    ordered: list[str] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            slug = str(row.get("slug") or "").strip()
            if not slug or slug not in nj_slugs or slug in seen:
                continue
            lt = str(row.get("lookup_line_type") or "").strip().lower()
            valid = str(row.get("lookup_valid") or "").strip().lower()
            if valid != "true" or lt not in ("mobile", "wireless"):
                continue
            seen.add(slug)
            ordered.append(slug)
    return ordered


def _fetch_table_mobile_rows(client: Any, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    page = 0
    page_size = min(1000, max(limit * 2, 100))
    while True:
        r = (
            client.table("salon_nj_mobile_phones")
            .select("slug,mobile,phone,name,address,zipcode,state,snapshot_date")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        batch = r.data or []
        out.extend(batch)
        if len(batch) < page_size:
            break
        page += 1
    return out


def _count_table_rows(client: Any) -> int:
    r = client.table("salon_nj_mobile_phones").select("slug", count="exact").limit(1).execute()
    return int(r.count or 0)


def _fetch_latest_for_slugs(client: Any, slugs: list[str]) -> dict[str, dict[str, Any]]:
    by_slug: dict[str, dict[str, Any]] = {}
    chunk = 100
    for i in range(0, len(slugs), chunk):
        part = slugs[i : i + chunk]
        r = (
            client.table("salon_ai_leaderboard_latest")
            .select("slug,name,phone,address,zipcode,state")
            .in_("slug", part)
            .execute()
        )
        for row in r.data or []:
            s = str(row.get("slug") or "").strip()
            if s:
                by_slug[s] = row
    return by_slug


def _slugs_from_exclude_files(paths: list[Path]) -> set[str]:
    """Load slug column from CSVs (e.g. outreach exports or twilio_sms_sent_log)."""
    out: set[str] = set()
    for path in paths:
        if not path.is_file():
            continue
        with path.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            fnames = reader.fieldnames or []
            slug_key = next((fn for fn in fnames if fn.lower() == "slug"), None)
            if slug_key:
                for row in reader:
                    s = str(row.get(slug_key) or "").strip()
                    if s:
                        out.add(s)
    return out


def _slug_to_e164_from_csv(csv_path: Path, slug_set: set[str]) -> dict[str, str]:
    """Map slug -> phone_e164 from CSV (first mobile row per slug)."""
    out: dict[str, str] = {}
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            slug = str(row.get("slug") or "").strip()
            if slug not in slug_set or slug in out:
                continue
            lt = str(row.get("lookup_line_type") or "").strip().lower()
            valid = str(row.get("lookup_valid") or "").strip().lower()
            if valid != "true" or lt not in ("mobile", "wireless"):
                continue
            e164 = str(row.get("phone_e164") or "").strip()
            if e164:
                out[slug] = e164
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Pick mobile NJ salons for SMS outreach CSV")
    p.add_argument("-o", "--output", default="data/sms_outreach_batch.csv", help="Output CSV path")
    p.add_argument("--limit", type=int, default=50, help="How many salons to pick (default 50)")
    p.add_argument("--seed", type=int, default=None, help="Random seed for sampling (optional)")
    p.add_argument("--csv", default="data/leaderboard_phone_sms.csv", help="Phone lookup export")
    p.add_argument("--state", default="NJ")
    p.add_argument(
        "--include-full-state-name",
        action="store_true",
        help='Treat state "New Jersey" as NJ',
    )
    p.add_argument(
        "--prefer-table",
        action="store_true",
        help="Use salon_nj_mobile_phones only (fail if empty)",
    )
    p.add_argument(
        "--no-table",
        action="store_true",
        help="Skip salon_nj_mobile_phones; use CSV + latest view only",
    )
    p.add_argument(
        "--no-personalize-greeting",
        action="store_true",
        help='Always use "Hi there," even when name is present',
    )
    p.add_argument(
        "--exclude-slugs-from",
        action="append",
        default=[],
        metavar="PATH",
        help="CSV with a slug column (repeatable): skip these salons (e.g. twilio_sms_sent_log.csv, prior outreach CSV)",
    )
    args = p.parse_args(argv)

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

    client = create_client(url, key)
    limit = max(1, int(args.limit))
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    excluded_slugs = _slugs_from_exclude_files([Path(p) for p in (args.exclude_slugs_from or [])])
    if excluded_slugs:
        print(f"Excluding {len(excluded_slugs)} slug(s) from prior sends / marker files.", file=sys.stderr)

    rows_out: list[dict[str, str]] = []

    use_table = not args.no_table
    if use_table and not args.prefer_table:
        try:
            n_tab = _count_table_rows(client)
        except Exception:
            n_tab = 0
        if n_tab == 0:
            use_table = False

    if args.prefer_table:
        use_table = True

    if use_table:
        tab_rows = _fetch_table_mobile_rows(client, limit * 3)
        if not tab_rows and args.prefer_table:
            print(
                "salon_nj_mobile_phones is empty. Apply sql/029_salon_nj_mobile_phones.sql then run:\n"
                "  python3 scripts/sync_salon_nj_mobile_phones.py --include-full-state-name\n"
                "Or omit --prefer-table to use CSV fallback.",
                file=sys.stderr,
            )
            return 1
        if tab_rows:
            if args.seed is not None:
                random.seed(args.seed)
            if excluded_slugs:
                tab_rows = [r for r in tab_rows if str(r.get("slug") or "").strip() not in excluded_slugs]
            random.shuffle(tab_rows)
            picked = tab_rows[:limit]
            for r in picked:
                rows_out.append(
                    {
                        "mobile_e164": str(r.get("mobile") or "").strip(),
                        "phone_raw": str(r.get("phone") or "").strip(),
                        "name": str(r.get("name") or "").strip(),
                        "address": str(r.get("address") or "").strip(),
                        "zipcode": str(r.get("zipcode") or "").strip(),
                        "state": str(r.get("state") or "").strip(),
                        "slug": str(r.get("slug") or "").strip(),
                        "snapshot_date": str(r.get("snapshot_date") or "").strip(),
                    }
                )

    if use_table and args.prefer_table and not rows_out:
        print(
            "No rows from salon_nj_mobile_phones after exclusions (--prefer-table). "
            "Refresh sync or relax exclusions.",
            file=sys.stderr,
        )
        return 1

    if not rows_out:
        csv_path = Path(args.csv)
        if not csv_path.is_file():
            print(f"Missing {csv_path}; run leaderboard_phone_sms_lookup.py first.", file=sys.stderr)
            return 1

        nj_slugs = _fetch_nj_slugs(
            client,
            args.state.strip() or "NJ",
            bool(args.include_full_state_name),
        )
        mobile_slugs = _mobile_slugs_from_csv(csv_path, nj_slugs)
        if excluded_slugs:
            mobile_slugs = [s for s in mobile_slugs if s not in excluded_slugs]
        if not mobile_slugs:
            print(
                "No NJ mobile/wireless rows left after exclusions (or none matched filter).",
                file=sys.stderr,
            )
            return 1

        if args.seed is not None:
            random.seed(args.seed)
        random.shuffle(mobile_slugs)
        chosen = mobile_slugs[: min(limit, len(mobile_slugs))]
        slug_set = set(chosen)
        e164_map = _slug_to_e164_from_csv(csv_path, slug_set)
        latest = _fetch_latest_for_slugs(client, chosen)

        for slug in chosen:
            row = latest.get(slug) or {}
            e164 = e164_map.get(slug, "")
            rows_out.append(
                {
                    "mobile_e164": e164,
                    "phone_raw": str(row.get("phone") or "").strip(),
                    "name": str(row.get("name") or "").strip(),
                    "address": str(row.get("address") or "").strip(),
                    "zipcode": str(row.get("zipcode") or "").strip(),
                    "state": str(row.get("state") or "").strip(),
                    "slug": slug,
                    "snapshot_date": "",
                }
            )

    for row in rows_out:
        nm = "" if args.no_personalize_greeting else str(row.get("name") or "").strip()
        row["sms_body"] = render_outreach_sms_body(nm, str(row.get("slug") or ""))

    fieldnames = [
        "mobile_e164",
        "phone_raw",
        "name",
        "address",
        "zipcode",
        "state",
        "slug",
        "snapshot_date",
        "sms_body",
    ]
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows_out:
            w.writerow(row)

    print(f"Wrote {len(rows_out)} rows to {out_path}")
    if len(rows_out) < limit:
        print(f"(Only {len(rows_out)} mobile NJ salons available.)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
