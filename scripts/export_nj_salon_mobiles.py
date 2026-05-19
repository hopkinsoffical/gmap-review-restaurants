#!/usr/bin/env python3
"""
Export NJ salons from salon_ai_leaderboard_latest with phone normalization and
optional Twilio Line Type Intelligence (mobile vs landline vs VoIP).

Without Twilio: number alone cannot prove "mobile"; mobile column stays empty and
is_mobile is blank.

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  Optional: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

Usage:
  python3 scripts/export_nj_salon_mobiles.py -o data/nj_salon_mobiles.csv
  python3 scripts/export_nj_salon_mobiles.py --skip-lookup -o data/nj_salons.csv
"""

from __future__ import annotations

import argparse
import csv
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


def _fetch_nj_latest(
    client: Any,
    state_eq: str,
    include_new_jersey_name: bool,
) -> list[dict[str, Any]]:
    states = [state_eq]
    if include_new_jersey_name:
        states.append("New Jersey")
    by_slug: dict[str, dict[str, Any]] = {}
    page_size = 1000
    base_cols = "id,slug,name,phone,address,zipcode,state"
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
    p = argparse.ArgumentParser(
        description="Export NJ rows from salon_ai_leaderboard_latest with mobile detection (Twilio)"
    )
    p.add_argument(
        "-o",
        "--output",
        default="data/nj_salon_mobiles.csv",
        help="Output CSV path",
    )
    p.add_argument(
        "--state",
        default="NJ",
        help="USPS state code to match when not using --include-full-state-name (default: NJ)",
    )
    p.add_argument(
        "--include-full-state-name",
        action="store_true",
        help='Also include rows where state = "New Jersey" (OR with --state)',
    )
    p.add_argument(
        "--sleep",
        type=float,
        default=0.12,
        help="Seconds between Twilio requests per distinct E.164",
    )
    p.add_argument(
        "--skip-lookup",
        action="store_true",
        help="Do not call Twilio; mobile / is_mobile left empty",
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

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    do_twilio = (not args.skip_lookup) and bool(account_sid) and bool(auth_token)
    if (not args.skip_lookup) and not do_twilio:
        print(
            "Twilio 未配置; 无法识别 mobile。使用 --skip-lookup 可静默仅导出字段。"
            " Configure TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN for Line Type Intelligence.",
            file=sys.stderr,
        )

    client = create_client(url, key)
    rows = _fetch_nj_latest(
        client,
        state_eq=args.state.strip() or "NJ",
        include_new_jersey_name=bool(args.include_full_state_name),
    )

    today = date.today().isoformat()
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "mobile",
        "phone",
        "phone_e164",
        "name",
        "current_date",
        "address",
        "zipcode",
        "state",
        "is_mobile",
        "twilio_line_type",
        "lookup_valid",
        "slug",
    ]

    cache: dict[str, tuple[bool | None, str | None, str, str]] = {}
    twilio_lookups = 0

    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            phone = str(row.get("phone") or "").strip()
            e164 = normalize_e164(phone) if phone else None

            mobile = ""
            is_mobile = ""
            lt_out = ""
            valid_s = ""
            v_b: bool | None = None
            lt: str | None = None

            if not phone or not e164:
                w.writerow(
                    {
                        "mobile": "",
                        "phone": phone,
                        "phone_e164": "",
                        "name": row.get("name", ""),
                        "current_date": today,
                        "address": row.get("address", ""),
                        "zipcode": row.get("zipcode", ""),
                        "state": row.get("state", ""),
                        "is_mobile": "",
                        "twilio_line_type": "",
                        "lookup_valid": "",
                        "slug": row.get("slug", ""),
                    }
                )
                continue

            if do_twilio:
                if e164 in cache:
                    v_b, lt, raw_twilio, _err = cache[e164]
                else:
                    if twilio_lookups > 0 and args.sleep > 0:
                        time.sleep(args.sleep)
                    v_b, lt, raw_twilio, _emsg = twilio_line_type_intelligence(
                        e164, account_sid, auth_token
                    )
                    cache[e164] = (v_b, lt, raw_twilio, _emsg)
                    twilio_lookups += 1
                lt_out = raw_twilio
                if v_b is True:
                    valid_s = "true"
                elif v_b is False:
                    valid_s = "false"
                if v_b is True and _is_mobile_line_type(lt):
                    mobile = e164
                    is_mobile = "true"
                elif v_b is True:
                    is_mobile = "false"
                else:
                    is_mobile = ""
            else:
                lt_out = "no_twilio" if not args.skip_lookup else "skipped"

            w.writerow(
                {
                    "mobile": mobile,
                    "phone": phone,
                    "phone_e164": e164,
                    "name": row.get("name", ""),
                    "current_date": today,
                    "address": row.get("address", ""),
                    "zipcode": row.get("zipcode", ""),
                    "state": row.get("state", ""),
                    "is_mobile": is_mobile,
                    "twilio_line_type": lt_out,
                    "lookup_valid": valid_s,
                    "slug": row.get("slug", ""),
                }
            )

    print(
        f"Wrote {len(rows)} NJ rows to {out_path} "
        f"(Twilio distinct lookups: {twilio_lookups}, export date: {today})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
