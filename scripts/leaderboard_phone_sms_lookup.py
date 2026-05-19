#!/usr/bin/env python3
"""
Export phones from public.salon_ai_leaderboard (view: salon_ai_leaderboard_latest) and
classify line type (mobile / landline / voip) for SMS targeting.

Mobile identification (US numbers):
  Requires Twilio Lookup API v2 with Line Type Intelligence add-on.
  Maps Twilio ``type`` -> lookup_line_type: mobile, wireless, landline, voip.
  Without Twilio, numbers cannot be classified (phone_type=no_lookup).

Also writes sms_reachability (Chinese) via phone_sms_reachability.sms_reachability.

Prereq (repo root):
  pip install -r pipelines/requirements.txt

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  Optional: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

Usage:
  python3 scripts/leaderboard_phone_sms_lookup.py -o data/leaderboard_phone_mobile.csv
  python3 scripts/leaderboard_phone_sms_lookup.py -o data/out.csv --sleep 0.2 --skip-lookup
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS = _ROOT / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from dotenv import load_dotenv  # noqa: E402
import certifi  # noqa: E402

from phone_sms_reachability import sms_reachability  # noqa: E402

_PIPE = _ROOT / "pipelines"
if str(_PIPE) not in sys.path:
    sys.path.insert(0, str(_PIPE))


def _load_env() -> None:
    # Base then overrides. python-dotenv does not override existing keys unless override=True,
    # so load lowest-priority first and apply local files with override=True.
    load_dotenv(_ROOT / ".env")
    load_dotenv(_ROOT / "local.env", override=True)
    load_dotenv(_ROOT / ".env.local", override=True)


def _env_strip(raw: str) -> str:
    """Trim and drop a single pair of surrounding quotes from .env values."""
    s = (raw or "").strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1].strip()
    return s


def normalize_e164(phone: str) -> str | None:
    """Best-effort E.164: US 10/11 digit -> +1; if + prefix keep only digits after +."""
    raw = (phone or "").strip()
    if not raw:
        return None
    if raw.startswith("+"):
        tail = re.sub(r"\D", "", raw[1:])
        return ("+" + tail) if tail else None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    return "+" + digits


def _map_twilio_line_type(raw: str) -> str | None:
    if not raw:
        return None
    t = raw.strip().lower()
    if t == "wireless":
        return "wireless"
    if t == "mobile":
        return "mobile"
    if t == "landline":
        return "landline"
    if t in ("voip", "nonfixedvoip", "fixedvoip", "non_fixed_voip", "fixed_voip"):
        return "voip"
    return None


def twilio_line_type_intelligence(
    e164: str,
    account_sid: str,
    auth_token: str,
    timeout: float = 30.0,
    *,
    max_attempts: int = 5,
    base_sleep_s: float = 1.0,
) -> tuple[bool | None, str | None, str, str]:
    """
    Returns (valid, line_type for sms_reachability, twilio raw type, error or empty).
    404 on lookup -> (False, None, "", "not_found").
    Retries transient TLS/TCP failures (e.g. Connection reset by peer).
    """
    enc = urllib.parse.quote(e164, safe="")
    q = urllib.parse.urlencode({"Fields": "line_type_intelligence"})
    url = f"https://lookups.twilio.com/v2/PhoneNumbers/{enc}?{q}"
    token = base64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
    req = urllib.request.Request(url, method="GET", headers={"Authorization": f"Basic {token}"})
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    body = ""
    last_err = ""
    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx) as resp:
                body = resp.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, None, "", "not_found"
            try:
                err = e.read().decode("utf-8")
            except OSError:
                err = str(e)
            return None, None, "", f"http_{e.code}: {err[:200]}"
        except urllib.error.URLError as e:
            last_err = f"url_error: {e.reason!s}"
        except (TimeoutError, ConnectionResetError, BrokenPipeError, OSError) as e:
            last_err = f"network: {type(e).__name__}: {e}"
        if attempt < max_attempts:
            time.sleep(base_sleep_s * attempt)
    else:
        return None, None, "", last_err or "twilio_request_failed"

    try:
        data: dict[str, Any] = json.loads(body) if body.strip() else {}
    except json.JSONDecodeError:
        return None, None, "", "invalid_json"

    valid = data.get("valid")
    v_bool: bool | None
    if valid is True:
        v_bool = True
    elif valid is False:
        v_bool = False
    else:
        v_bool = None

    lti = data.get("line_type_intelligence")
    if not isinstance(lti, dict):
        lti = {}
    raw_type = str(lti.get("type") or "").strip()
    if v_bool is not True:
        return v_bool, None, raw_type, ""

    mapped = _map_twilio_line_type(raw_type)
    return v_bool, mapped, raw_type, ""


def _fetch_all_latest_phones() -> list[dict[str, Any]]:
    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        print("Install: pip install -r pipelines/requirements.txt", file=sys.stderr)
        raise SystemExit(1) from None

    _load_env()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        raise SystemExit(1)

    client = create_client(url, key)
    out: list[dict[str, Any]] = []
    page = 0
    page_size = 1000
    while True:
        r = (
            client.table("salon_ai_leaderboard_latest")
            .select("id,slug,name,phone")
            .order("slug")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        batch = r.data or []
        out.extend(batch)
        if len(batch) < page_size:
            break
        page += 1
    return out


def _fmt_valid(v: bool | None) -> str:
    if v is True:
        return "true"
    if v is False:
        return "false"
    return ""


def _fmt_mobile_flag(valid: bool | None, line_type: str | None) -> str:
    """true = likely SMS-capable mobile/wireless; false = landline when known valid."""
    if valid is not True:
        return ""
    lt = (line_type or "").strip().lower()
    if lt in ("mobile", "wireless"):
        return "true"
    if lt == "landline":
        return "false"
    return ""


def _phone_type_bucket(
    *,
    phone: str,
    e164_ok: bool,
    valid: bool | None,
    line_type: str | None,
    raw_twilio: str,
    lookup_error: str,
    twilio_enabled: bool,
) -> str:
    """Stable English label for filtering (one column)."""
    if not (phone or "").strip():
        return "empty"
    if not e164_ok:
        return "unparsed"
    if not twilio_enabled:
        return "no_lookup"
    err = (lookup_error or "").strip()
    if err == "not_found":
        return "not_found"
    if valid is False:
        return "invalid"
    lt = (line_type or "").strip().lower()
    if lt:
        return lt
    raw = (raw_twilio or "").strip().lower()
    if raw:
        return raw
    if err and err not in ("", "no_twilio"):
        return "lookup_error"
    return "unknown"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Label SMS reachability for salon_ai_leaderboard_latest phones (optional Twilio)"
    )
    p.add_argument(
        "-o",
        "--output",
        default="data/leaderboard_phone_sms.csv",
        help="Output CSV (default: data/leaderboard_phone_sms.csv)",
    )
    p.add_argument(
        "--sleep",
        type=float,
        default=0.12,
        help="Seconds between Twilio requests (one per distinct E.164, default: 0.12)",
    )
    p.add_argument(
        "--skip-lookup",
        action="store_true",
        help="Do not call Twilio; only empty vs non-empty 启发式",
    )
    args = p.parse_args(argv)

    _load_env()
    account_sid = _env_strip(os.environ.get("TWILIO_ACCOUNT_SID", ""))
    auth_token = _env_strip(os.environ.get("TWILIO_AUTH_TOKEN", ""))
    do_twilio = (not args.skip_lookup) and bool(account_sid) and bool(auth_token)
    if (not args.skip_lookup) and not do_twilio:
        print(
            "Twilio 未配置 (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN); "
            "空行标 不可用，其余标 需要测试短信确认。使用 --skip-lookup 可跳过本提示。",
            file=sys.stderr,
        )

    rows = _fetch_all_latest_phones()
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Distinct E.164 -> (valid, line_type, raw_twilio, error) after first lookup
    cache: dict[str, tuple[bool | None, str | None, str, str]] = {}

    fieldnames = [
        "id",
        "slug",
        "name",
        "phone",
        "phone_e164",
        "phone_type",
        "is_mobile_like",
        "lookup_valid",
        "twilio_line_type_raw",
        "lookup_line_type",
        "lookup_error",
        "sms_reachability",
    ]

    twilio_lookups = 0
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            phone = str(row.get("phone") or "").strip()
            e164 = normalize_e164(phone) if phone else None

            if not phone or not e164:
                w.writerow(
                    {
                        "id": row.get("id", ""),
                        "slug": row.get("slug", ""),
                        "name": row.get("name", ""),
                        "phone": phone,
                        "phone_e164": "",
                        "phone_type": "empty" if not phone else "unparsed",
                        "is_mobile_like": "",
                        "lookup_valid": "",
                        "twilio_line_type_raw": "",
                        "lookup_line_type": "",
                        "lookup_error": "empty" if not phone else "unparsed",
                        "sms_reachability": sms_reachability(False, None),
                    }
                )
                continue

            v_b: bool | None = None
            lt: str | None = None
            raw_twilio = ""
            err = ""
            if do_twilio:
                if e164 in cache:
                    v_b, lt, raw_twilio, err = cache[e164]
                else:
                    if twilio_lookups > 0 and args.sleep > 0:
                        time.sleep(args.sleep)
                    v_b, mapped, raw_twilio, emsg = twilio_line_type_intelligence(
                        e164, account_sid, auth_token
                    )
                    lt = mapped
                    err = emsg
                    cache[e164] = (v_b, lt, raw_twilio, err)
                    twilio_lookups += 1
            else:
                err = "no_twilio" if not args.skip_lookup else "skipped"
                v_b = None
                lt = None

            ptype = _phone_type_bucket(
                phone=phone,
                e164_ok=True,
                valid=v_b,
                line_type=lt,
                raw_twilio=raw_twilio,
                lookup_error=err,
                twilio_enabled=do_twilio,
            )
            w.writerow(
                {
                    "id": row.get("id", ""),
                    "slug": row.get("slug", ""),
                    "name": row.get("name", ""),
                    "phone": phone,
                    "phone_e164": e164,
                    "phone_type": ptype,
                    "is_mobile_like": _fmt_mobile_flag(v_b, lt),
                    "lookup_valid": _fmt_valid(v_b),
                    "twilio_line_type_raw": raw_twilio,
                    "lookup_line_type": (lt or ""),
                    "lookup_error": err,
                    "sms_reachability": sms_reachability(v_b, lt),
                }
            )

    print(f"Wrote {len(rows)} rows to {out_path} (Twilio distinct lookups: {twilio_lookups})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
