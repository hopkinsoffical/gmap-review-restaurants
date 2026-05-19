#!/usr/bin/env python3
"""
Send SMS via Twilio using a CSV from pick_sms_outreach_batch.py (mobile_e164 + sms_body).

Env:
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
  TWILIO_SMS_FROM — your Twilio sender number (E.164), e.g. +19083328659

Usage:
  python3 scripts/send_twilio_sms_batch.py --csv data/sms_outreach_50.csv
  python3 scripts/send_twilio_sms_batch.py --csv data/sms_outreach_50.csv --send --sleep 1
  python3 scripts/send_twilio_sms_batch.py --csv data/sms_outreach_50.csv --send --offset 1 --sleep 1

Without --send: prints each recipient (dry-run only).

Successful sends (--send) are appended to --sent-log (default data/twilio_sms_sent_log.csv).
Official history: Twilio Console → Monitor → Logs → Messaging.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import ssl
import sys
import time
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]

from dotenv import load_dotenv  # noqa: E402

try:
    import certifi  # noqa: E402
except ImportError:
    certifi = None  # type: ignore


def _load_env() -> None:
    load_dotenv(_ROOT / ".env.local")
    load_dotenv(_ROOT / ".env")


def _twilio_post_messages(
    account_sid: str,
    auth_token: str,
    from_num: str,
    to_e164: str,
    body: str,
    timeout: float = 60.0,
) -> tuple[int, str]:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    payload = urllib.parse.urlencode(
        {"To": to_e164, "From": from_num, "Body": body},
        encoding="utf-8",
    ).encode("utf-8")
    token = base64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Basic {token}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")

    ctx = None
    if certifi:
        ctx = ssl.create_default_context(cafile=certifi.where())

    try:
        opener_ctx = ctx if ctx else None
        with urllib.request.urlopen(req, timeout=timeout, context=opener_ctx) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, text
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except OSError:
            err_body = str(e)
        return e.code, err_body


def _append_sent_log(
    log_path: Path,
    *,
    message_sid: str,
    from_e164: str,
    to_e164: str,
    slug: str,
    source_csv: str,
) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    new_file = not log_path.is_file()
    fieldnames = [
        "sent_at_utc",
        "message_sid",
        "from_e164",
        "to_e164",
        "slug",
        "source_csv",
    ]
    row = {
        "sent_at_utc": datetime.now(timezone.utc).isoformat(),
        "message_sid": message_sid,
        "from_e164": from_e164,
        "to_e164": to_e164,
        "slug": slug,
        "source_csv": source_csv,
    }
    with log_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        if new_file:
            w.writeheader()
        w.writerow(row)


def _register_sms_funnel_session(base_url: str, secret: str, slug: str, to_e164: str, message_sid: str) -> None:
    """Optional: POST /api/sms-outreach-register so nurture can match session to MessageSid."""
    url = base_url.rstrip("/") + "/api/sms-outreach-register"
    body = json.dumps(
        {"slug": slug, "to_e164": to_e164, "initial_message_sid": message_sid},
        separators=(",", ":"),
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "X-Sms-Funnel-Secret": secret,
        },
    )
    ssl_ctx = ssl.create_default_context(cafile=certifi.where()) if certifi else None
    try:
        kw = {"timeout": 20}
        if ssl_ctx:
            kw["context"] = ssl_ctx
        with urllib.request.urlopen(req, **kw) as resp:
            _ = resp.read()
    except urllib.error.HTTPError as e:
        print(f"[sms-funnel-register] http_{e.code}", file=sys.stderr)
    except urllib.error.URLError as e:
        print(f"[sms-funnel-register] {e.reason!s}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Send Twilio SMS from outreach CSV")
    p.add_argument("--csv", default="data/sms_outreach_50.csv", help="CSV with mobile_e164 + sms_body")
    p.add_argument("--send", action="store_true", help="Actually send SMS (omit for dry-run preview)")
    p.add_argument("--limit", type=int, default=0, help="Max rows (0 = all)")
    p.add_argument("--offset", type=int, default=0, help="Skip first N CSV data rows (after header)")
    p.add_argument("--sleep", type=float, default=0.5, help="Seconds between sends")
    p.add_argument(
        "--sent-log",
        default="data/twilio_sms_sent_log.csv",
        help="Append successful sends to this CSV (UTC timestamps). Empty string disables.",
    )
    args = p.parse_args(argv)

    dry_run = not args.send

    _load_env()
    sid = "".join(os.environ.get("TWILIO_ACCOUNT_SID", "").split())
    tok = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    from_num = os.environ.get("TWILIO_SMS_FROM", "").strip()

    csv_path = Path(args.csv)
    if not csv_path.is_file():
        print(f"Missing CSV: {csv_path}", file=sys.stderr)
        return 1

    if not dry_run:
        if not sid or not tok:
            print("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN", file=sys.stderr)
            return 1
        if not from_num:
            print(
                "Missing TWILIO_SMS_FROM (your Twilio phone number E.164). "
                "Add to .env.local e.g. TWILIO_SMS_FROM=+19083328659",
                file=sys.stderr,
            )
            return 1

    rows: list[dict[str, str]] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))

    off = max(0, int(args.offset))
    if off:
        rows = rows[off:]
    lim = int(args.limit or 0)
    if lim > 0:
        rows = rows[:lim]

    ok = 0
    fail = 0
    for i, row in enumerate(rows):
        to_e164 = str(row.get("mobile_e164") or "").strip()
        body = str(row.get("sms_body") or "").strip()
        slug = str(row.get("slug") or "").strip()
        if not to_e164 or not body:
            print(f"[skip {i + 1}] missing mobile_e164 or sms_body slug={slug}", file=sys.stderr)
            fail += 1
            continue

        if dry_run:
            preview = body.replace("\n", " ")[:80]
            print(f"[dry-run] To={to_e164} slug={slug} body_preview={preview!s}…")
            ok += 1
            continue

        code, text = _twilio_post_messages(sid, tok, from_num, to_e164, body)
        if code in (200, 201):
            ok += 1
            msid = ""
            try:
                data = json.loads(text) if text.strip() else {}
                msid = str(data.get("sid") or "")
                print(f"[sent] {to_e164} sid={msid}")
            except json.JSONDecodeError:
                print(f"[sent] {to_e164}")
            log_arg = str(args.sent_log or "").strip()
            if log_arg:
                _append_sent_log(
                    Path(log_arg),
                    message_sid=msid,
                    from_e164=from_num,
                    to_e164=to_e164,
                    slug=slug,
                    source_csv=str(csv_path),
                )
            reg_base = os.environ.get("APP_BASE_URL", "").strip()
            reg_secret = os.environ.get("SMS_FUNNEL_REGISTER_SECRET", "").strip()
            if reg_base and reg_secret and msid and slug:
                _register_sms_funnel_session(reg_base, reg_secret, slug, to_e164, msid)
        else:
            fail += 1
            print(f"[fail] {to_e164} http={code} {text[:300]}", file=sys.stderr)

        if i < len(rows) - 1 and args.sleep > 0:
            time.sleep(float(args.sleep))

    mode = "dry-run" if dry_run else "live"
    print(f"Done ({mode}): ok={ok} fail={fail}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
