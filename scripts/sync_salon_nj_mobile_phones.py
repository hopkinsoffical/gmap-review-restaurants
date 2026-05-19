#!/usr/bin/env python3
"""
Fill public.salon_nj_mobile_phones from salon_ai_leaderboard_latest (NJ only) using
Twilio Lookup Line Type Intelligence. Only stores rows where line type is mobile/wireless.

Intended workflow (phone pool for SMS):
  1) Phones originate from leaderboard data (view: salon_ai_leaderboard_latest).
  2) Twilio Lookup classifies each distinct E.164 as mobile/wireless or not.
  3) Mobile rows are upserted into public.salon_nj_mobile_phones.
  4) pick_sms_outreach_batch.py + send_twilio_sms_batch.py read slug, name, mobile from
     that table (--prefer-table) and use render_outreach_sms_body() for copy.

Requires: sql/029_salon_nj_mobile_phones.sql applied in Supabase.

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role)
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

Usage:
  python3 scripts/sync_salon_nj_mobile_phones.py
  python3 scripts/sync_salon_nj_mobile_phones.py --truncate-first --include-full-state-name
  python3 scripts/sync_salon_nj_mobile_phones.py --include-full-state-name --max-rows 100  # smoke test
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS = _ROOT / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from dotenv import load_dotenv  # noqa: E402

from leaderboard_phone_sms_lookup import (  # noqa: E402
    normalize_e164,
    twilio_line_type_intelligence,
)


def _load_env() -> None:
    load_dotenv(_ROOT / ".env.local")
    load_dotenv(_ROOT / ".env")


def _is_mobile_line_type(lt: str | None) -> bool:
    if not lt:
        return False
    return lt.strip().lower() in ("mobile", "wireless")


def _norm_state(raw: str) -> str:
    s = (raw or "").strip()
    if s.upper() == "NJ" or s.lower() == "new jersey":
        return "NJ"
    return s or "NJ"


def _fetch_nj_latest(
    client: Any,
    state_eq: str,
    include_new_jersey_name: bool,
) -> list[dict[str, Any]]:
    """Paginate per state value and merge by slug (avoids fragile PostgREST or() on state)."""
    states = [state_eq]
    if include_new_jersey_name:
        states.append("New Jersey")
    by_slug: dict[str, dict[str, Any]] = {}
    page_size = 1000
    base_cols = "slug,name,phone,address,zipcode,state"
    for st in states:
        page = 0
        while True:
            r = (
                client.table("salon_ai_leaderboard_latest")
                .select(base_cols)
                .eq("state", st)
                .range(page * page_size, (page + 1) * page_size - 1)
                .execute()
            )
            batch = r.data or []
            for row in batch:
                slug = str(row.get("slug") or "").strip()
                if slug:
                    by_slug[slug] = row
            if len(batch) < page_size:
                break
            page += 1
    return list(by_slug.values())


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Sync salon_nj_mobile_phones from leaderboard + Twilio")
    p.add_argument("--state", default="NJ", help="USPS code filter (default NJ)")
    p.add_argument(
        "--include-full-state-name",
        action="store_true",
        help='Include rows where state = "New Jersey"',
    )
    p.add_argument(
        "--sleep",
        type=float,
        default=0.12,
        help="Seconds between Twilio requests per distinct E.164",
    )
    p.add_argument(
        "--truncate-first",
        action="store_true",
        help="Delete all rows in salon_nj_mobile_phones before upsert (full refresh)",
    )
    p.add_argument("--chunk-size", type=int, default=100, help="Upsert batch size")
    p.add_argument(
        "--max-rows",
        type=int,
        default=0,
        metavar="N",
        help="Only process the first N merged leaderboard rows (0 = all). Useful for smoke tests.",
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
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()

    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1
    if not account_sid or not auth_token:
        print("Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN for mobile detection.", file=sys.stderr)
        return 1

    client = create_client(url, key)
    rows = _fetch_nj_latest(
        client,
        state_eq=args.state.strip() or "NJ",
        include_new_jersey_name=bool(args.include_full_state_name),
    )
    cap = int(args.max_rows or 0)
    if cap > 0:
        rows = rows[:cap]
        print(f"[sync] --max-rows={cap}: scanning subset only.", file=sys.stderr)

    today = date.today().isoformat()
    cache: dict[str, tuple[bool | None, str | None, str, str]] = {}
    twilio_lookups = 0

    upserts: list[dict[str, Any]] = []
    for row in rows:
        phone = str(row.get("phone") or "").strip()
        slug = str(row.get("slug") or "").strip()
        if not phone or not slug:
            continue
        e164 = normalize_e164(phone)
        if not e164:
            continue

        if e164 in cache:
            v_b, lt, raw_twilio, _err = cache[e164]
        else:
            if twilio_lookups > 0 and args.sleep > 0:
                time.sleep(args.sleep)
            v_b, lt, raw_twilio, _emsg = twilio_line_type_intelligence(e164, account_sid, auth_token)
            cache[e164] = (v_b, lt, raw_twilio, _emsg)
            twilio_lookups += 1

        if v_b is not True or not _is_mobile_line_type(lt):
            continue

        upserts.append(
            {
                "slug": slug,
                "mobile": e164,
                "phone": phone,
                "name": str(row.get("name") or "").strip() or slug,
                "snapshot_date": today,
                "address": str(row.get("address") or ""),
                "zipcode": str(row.get("zipcode") or ""),
                "state": _norm_state(str(row.get("state") or "")),
                "twilio_line_type": raw_twilio or (lt or ""),
            }
        )

    if args.truncate_first:
        del_resp = client.table("salon_nj_mobile_phones").delete().neq("slug", "").execute()
        _ = del_resp

    chunk_size = max(1, int(args.chunk_size))
    for i in range(0, len(upserts), chunk_size):
        chunk = upserts[i : i + chunk_size]
        client.table("salon_nj_mobile_phones").upsert(chunk, on_conflict="slug").execute()

    print(
        f"Synced {len(upserts)} mobile NJ salons (Twilio lookups: {twilio_lookups}, "
        f"snapshot_date={today}, scanned leaderboard rows={len(rows)})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
