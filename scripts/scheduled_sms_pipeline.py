#!/usr/bin/env python3
"""
Scheduled SMS pipeline: pick NJ mobile salons (excluding sent slugs), send, log.

Phone pool (recommended):
  1) salon_ai_leaderboard_latest — source phones (sync reads this view).
  2) Twilio Lookup — mobile/wireless classification (sync_salon_nj_mobile_phones.py).
  3) public.salon_nj_mobile_phones — upsert verified mobiles (sql/029_salon_nj_mobile_phones.sql).
  4) pick_sms_outreach_batch --prefer-table — slug, name, mobile + sms_body; then send_twilio_sms_batch.

By default this pipeline passes --prefer-table to the picker (requires a populated salon_nj_mobile_phones).
Use --allow-phone-csv-pool to fall back to data/leaderboard_phone_sms.csv + view (legacy).

Designed for cron / GitHub Actions:
  - Default: infer slot from America/New_York time (9 / 12 / 17 / 18 first ~30 min of hour).
  - Or pass --slot morning|noon|evening|six_pm when your scheduler fires at fixed UTC times.

Idempotency: data/sms_schedule_state.json records {date, slot} so the same slot is not sent twice per day.

Env: same as pick_sms_outreach_batch + send_twilio_sms_batch (SUPABASE_*, TWILIO_*).

Usage:
  python3 scripts/scheduled_sms_pipeline.py --dry-run
  python3 scripts/scheduled_sms_pipeline.py --send
  python3 scripts/scheduled_sms_pipeline.py --slot morning --send
  python3 scripts/scheduled_sms_pipeline.py --slot six_pm --send
  python3 scripts/scheduled_sms_pipeline.py --slot morning --send --allow-phone-csv-pool
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]
_STATE_PATH = _ROOT / "data" / "sms_schedule_state.json"


def _load_state() -> dict[str, Any]:
    if not _STATE_PATH.is_file():
        return {"completed": []}
    try:
        return json.loads(_STATE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"completed": []}


def _save_state(state: dict[str, Any]) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    completed = state.get("completed") or []
    if len(completed) > 400:
        completed = completed[-400:]
    state["completed"] = completed
    _STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _already_done(date_str: str, slot: str) -> bool:
    st = _load_state()
    for item in st.get("completed") or []:
        if item.get("date") == date_str and item.get("slot") == slot:
            return True
    return False


def _mark_done(date_str: str, slot: str, csv_name: str, sent: int) -> None:
    st = _load_state()
    st.setdefault("completed", []).append(
        {"date": date_str, "slot": slot, "csv": csv_name, "sent": sent}
    )
    _save_state(st)


def _infer_slot_for_tz(tz_name: str) -> str | None:
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        print("Python 3.9+ zoneinfo required.", file=sys.stderr)
        return None
    ny = datetime.now(ZoneInfo(tz_name))
    h, m = ny.hour, ny.minute
    if h == 9 and m <= 30:
        return "morning"
    if h == 12 and m <= 30:
        return "noon"
    if h == 17 and m <= 30:
        return "evening"
    if h == 18 and m <= 30:
        return "six_pm"
    return None


def _run(cmd: list[str]) -> int:
    print("+", " ".join(cmd), file=sys.stderr)
    p = subprocess.run(cmd, cwd=str(_ROOT))
    return int(p.returncode)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Scheduled pick+send 50 mobile NJ SMS")
    p.add_argument("--send", action="store_true", help="Actually send (default: pick CSV only)")
    p.add_argument("--dry-run", action="store_true", help="Same as omitting --send (pick only)")
    p.add_argument(
        "--slot",
        choices=("morning", "noon", "evening", "six_pm"),
        help="Force slot (skip NY clock inference). six_pm = 6:00-6:30pm NYC.",
    )
    p.add_argument(
        "--auto-slot",
        action="store_true",
        help="Infer slot from America/New_York (9/12/17/18 :00-:30)",
    )
    p.add_argument("--limit", type=int, default=50, help="Recipients per run")
    p.add_argument("--timezone", default="America/New_York", help="Used with --auto-slot (IANA name)")
    p.add_argument("--sent-log", default="data/twilio_sms_sent_log.csv")
    p.add_argument("--phone-csv", default="data/leaderboard_phone_sms.csv")
    p.add_argument(
        "--allow-phone-csv-pool",
        action="store_true",
        help="Allow CSV+view fallback in pick (omit --prefer-table). Default is DB table salon_nj_mobile_phones only.",
    )
    args = p.parse_args(argv)
    if args.dry_run:
        args.send = False

    py = sys.executable

    if args.slot:
        slot = args.slot
    elif args.auto_slot:
        slot = _infer_slot_for_tz(args.timezone)
        if not slot:
            print(
                f"Not in a send window ({args.timezone} 9:00-9:30, 12:00-12:30, 17:00-17:30, or 18:00-18:30). Exit 0.",
                file=sys.stderr,
            )
            return 0
    else:
        slot = _infer_slot_for_tz(args.timezone)
        if not slot:
            print("Use --slot morning|noon|evening|six_pm, or --auto-slot.", file=sys.stderr)
            return 2

    try:
        from zoneinfo import ZoneInfo

        date_str = datetime.now(ZoneInfo(args.timezone)).strftime("%Y-%m-%d")
    except Exception:
        date_str = datetime.now().strftime("%Y-%m-%d")

    if _already_done(date_str, slot):
        print(f"Already completed {date_str} {slot}. Skip.", file=sys.stderr)
        return 0

    out_csv = _ROOT / "data" / f"sms_scheduled_{date_str}_{slot}.csv"
    pick_cmd = [
        py,
        str(_ROOT / "scripts" / "pick_sms_outreach_batch.py"),
        "-o",
        str(out_csv),
        "--limit",
        str(max(1, int(args.limit))),
        "--exclude-slugs-from",
        str(_ROOT / args.sent_log),
        "--csv",
        str(_ROOT / args.phone_csv),
    ]
    pick_cmd.append("--include-full-state-name")
    if not args.allow_phone_csv_pool:
        pick_cmd.append("--prefer-table")

    if _run(pick_cmd) != 0:
        return 1

    try:
        import csv as _csv

        with out_csv.open(newline="", encoding="utf-8-sig") as f:
            n_out = sum(1 for _ in _csv.DictReader(f))
    except OSError:
        n_out = 0
    if n_out == 0:
        print(f"No rows picked (empty pool after exclusions): {out_csv}", file=sys.stderr)
        return 1

    if not args.send:
        print(f"Dry-run: wrote {out_csv}. Re-run with --send to transmit.", file=sys.stderr)
        return 0

    send_cmd = [
        py,
        str(_ROOT / "scripts" / "send_twilio_sms_batch.py"),
        "--csv",
        str(out_csv),
        "--send",
        "--sleep",
        "1",
        "--sent-log",
        str(_ROOT / args.sent_log),
    ]
    rc = _run(send_cmd)
    if rc != 0:
        return rc

    _mark_done(date_str, slot, out_csv.name, n_out)
    print(f"Marked completed: {date_str} {slot}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
