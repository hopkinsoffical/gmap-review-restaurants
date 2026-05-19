#!/usr/bin/env python3
"""
Fetch salon-like places in Edison, NJ via Google Places API (New) text search,
then ingest into public.salon_ai_leaderboard using the same scoring as ingest_salon_ai_leaderboard.py.

Requires:
  - GOOGLE_PLACES_API_KEY (Places API New enabled)
  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (unless --dry-run)

Usage (repo root):
  python3 pipelines/fetch_ingest_edison_nj_salons.py
  python3 pipelines/fetch_ingest_edison_nj_salons.py --dry-run   # writes data/edison-nj-salons-fetched.json only
  npm run ingest:edison:py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote

_PIPELINES_DIR = Path(__file__).resolve().parent
ROOT = _PIPELINES_DIR.parent
sys.path.insert(0, str(_PIPELINES_DIR))

import certifi  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

PLACES_BASE = "https://places.googleapis.com/v1"
_SSL_CTX = ssl.create_default_context(cafile=certifi.where())

# Approximate Edison, NJ center (Middlesex County)
EDISON_LAT = 40.518715
EDISON_LNG = -74.412095
LOCATION_RADIUS_M = 9000.0

# (includedType, textQuery hint) — one type per request; paginate with nextPageToken
SEARCH_SPECS: list[tuple[str, str]] = [
    ("hair_care", "hair salon Edison New Jersey"),
    ("beauty_salon", "beauty salon Edison New Jersey"),
    ("nail_salon", "nail salon Edison New Jersey"),
    ("spa", "day spa Edison New Jersey"),
    ("barber_shop", "barber shop Edison New Jersey"),
]

PLACE_DETAIL_MASK = (
    "id,name,displayName,rating,userRatingCount,reviews,formattedAddress,"
    "nationalPhoneNumber,websiteUri,addressComponents,types,primaryType"
)

SEARCH_FIELD_MASK = "places.id,nextPageToken"


def search_specs_for_town(town_label: str) -> list[tuple[str, str]]:
    """Same included types as Edison; textQuery anchors the municipality + NJ."""
    t = (town_label or "").strip()
    if not t:
        raise ValueError("town_label is required")
    return [
        ("hair_care", f"hair salon {t} New Jersey"),
        ("beauty_salon", f"beauty salon {t} New Jersey"),
        ("nail_salon", f"nail salon {t} New Jersey"),
        ("spa", f"day spa {t} New Jersey"),
        ("barber_shop", f"barber shop {t} New Jersey"),
    ]

# Google longText uses full state names; DB / UI default use USPS abbreviations.
_STATE_LONG_TO_ABBR: dict[str, str] = {}
for _pair in (
    ("AL", "Alabama"),
    ("AK", "Alaska"),
    ("AZ", "Arizona"),
    ("AR", "Arkansas"),
    ("CA", "California"),
    ("CO", "Colorado"),
    ("CT", "Connecticut"),
    ("DE", "Delaware"),
    ("DC", "District of Columbia"),
    ("FL", "Florida"),
    ("GA", "Georgia"),
    ("HI", "Hawaii"),
    ("ID", "Idaho"),
    ("IL", "Illinois"),
    ("IN", "Indiana"),
    ("IA", "Iowa"),
    ("KS", "Kansas"),
    ("KY", "Kentucky"),
    ("LA", "Louisiana"),
    ("ME", "Maine"),
    ("MD", "Maryland"),
    ("MA", "Massachusetts"),
    ("MI", "Michigan"),
    ("MN", "Minnesota"),
    ("MS", "Mississippi"),
    ("MO", "Missouri"),
    ("MT", "Montana"),
    ("NE", "Nebraska"),
    ("NV", "Nevada"),
    ("NH", "New Hampshire"),
    ("NJ", "New Jersey"),
    ("NM", "New Mexico"),
    ("NY", "New York"),
    ("NC", "North Carolina"),
    ("ND", "North Dakota"),
    ("OH", "Ohio"),
    ("OK", "Oklahoma"),
    ("OR", "Oregon"),
    ("PA", "Pennsylvania"),
    ("RI", "Rhode Island"),
    ("SC", "South Carolina"),
    ("SD", "South Dakota"),
    ("TN", "Tennessee"),
    ("TX", "Texas"),
    ("UT", "Utah"),
    ("VT", "Vermont"),
    ("VA", "Virginia"),
    ("WA", "Washington"),
    ("WV", "West Virginia"),
    ("WI", "Wisconsin"),
    ("WY", "Wyoming"),
):
    _STATE_LONG_TO_ABBR[_pair[1].lower()] = _pair[0]


def _canonical_us_state(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    if len(s) == 2 and s.isalpha():
        return s.upper()
    return _STATE_LONG_TO_ABBR.get(s.lower(), s)


def _load_env() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")


def _norm_place_id(raw: str) -> str:
    s = (raw or "").strip()
    if s.startswith("places/"):
        return s[len("places/") :]
    return s


def _http_json(method: str, url: str, api_key: str, body: dict[str, Any] | None, field_mask: str) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Goog-Api-Key", api_key)
    req.add_header("X-Goog-FieldMask", field_mask)
    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Places HTTP {e.code}: {err_body}") from e


def _search_text_page(
    api_key: str,
    text_query: str,
    included_type: str,
    page_token: str | None,
    *,
    center_lat: float = EDISON_LAT,
    center_lng: float = EDISON_LNG,
    radius_m: float | None = None,
) -> dict[str, Any]:
    # searchText uses locationBias.circle (locationRestriction shape differs from nearby search).
    rm = float(radius_m) if radius_m is not None else float(LOCATION_RADIUS_M)
    body: dict[str, Any] = {
        "textQuery": text_query,
        "includedType": included_type,
        "pageSize": 20,
        "languageCode": "en",
        "regionCode": "US",
        "locationBias": {
            "circle": {
                "center": {"latitude": float(center_lat), "longitude": float(center_lng)},
                "radius": rm,
            }
        },
    }
    if page_token:
        body["pageToken"] = page_token
    return _http_json("POST", f"{PLACES_BASE}/places:searchText", api_key, body, SEARCH_FIELD_MASK)


def _place_details(api_key: str, place_id: str) -> dict[str, Any]:
    pid = _norm_place_id(place_id)
    enc = quote(pid, safe="")
    url = f"{PLACES_BASE}/places/{enc}"
    return _http_json("GET", url, api_key, None, PLACE_DETAIL_MASK)


def _display_name(place: dict[str, Any]) -> str:
    dn = place.get("displayName")
    if isinstance(dn, dict) and dn.get("text"):
        return str(dn["text"]).strip()
    if isinstance(dn, str):
        return dn.strip()
    return str(place.get("name") or "").strip()


def _address_parts(components: Any) -> dict[str, str]:
    out = {"state": "", "county": "", "town": "", "zipcode": ""}
    if not isinstance(components, list):
        return out
    for c in components:
        if not isinstance(c, dict):
            continue
        types = c.get("types") or []
        long_text = str(c.get("longText") or c.get("shortText") or "").strip()
        if "administrative_area_level_1" in types:
            out["state"] = long_text
        elif "administrative_area_level_2" in types:
            out["county"] = re.sub(r"\s+County$", "", long_text, flags=re.I)
        elif "locality" in types:
            out["town"] = long_text
        elif "postal_code" in types:
            out["zipcode"] = long_text
    return out


def _stable_slug(name: str, place_id: str) -> str:
    h = hashlib.sha256(place_id.encode("utf-8")).hexdigest()[:10]
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:28] or "salon"
    cand = f"{base}-{h}"
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", cand):
        return cand
    return f"salon-{h}"


def _reviews_for_ingest(place: dict[str, Any]) -> list[dict[str, Any]] | None:
    revs = place.get("reviews")
    if not isinstance(revs, list) or not revs:
        return None
    out: list[dict[str, Any]] = []
    for r in revs:
        if not isinstance(r, dict):
            continue
        rating = r.get("rating")
        pt = r.get("publishTime") or r.get("publish_time")
        item: dict[str, Any] = {}
        if rating is not None:
            item["rating"] = rating
        if pt:
            item["publishTime"] = pt
        if item:
            out.append(item)
    return out or None


def _place_to_source_row(
    place: dict[str, Any],
    *,
    town_fallback: str = "Edison",
    county_fallback: str = "Middlesex",
    state_fallback: str = "NJ",
) -> dict[str, Any]:
    pid = _norm_place_id(str(place.get("id") or ""))
    name = _display_name(place)
    parts = _address_parts(place.get("addressComponents"))
    rating = float(place.get("rating") or 0)
    try:
        nrev = int(place.get("userRatingCount") or 0)
    except (TypeError, ValueError):
        nrev = 0
    types = place.get("types")
    primary = place.get("primaryType")
    category = ""
    if isinstance(primary, str) and primary.strip():
        category = primary.replace("_", " ").strip()
    elif isinstance(types, list) and types:
        category = str(types[0]).replace("_", " ").strip()

    town = parts["town"] or town_fallback
    county = parts["county"] or county_fallback
    sf = (state_fallback or "NJ").strip() or "NJ"
    state = _canonical_us_state(parts["state"]) or sf

    return {
        "slug": _stable_slug(name, pid),
        "place_id": pid,
        "google_place_id": pid,
        "name": name,
        "address": str(place.get("formattedAddress") or "").strip(),
        "state": state,
        "county": county,
        "town": town,
        "zipcode": parts["zipcode"],
        "category": category,
        "rating": rating,
        "review_count": max(0, nrev),
        "phone": str(place.get("nationalPhoneNumber") or "").strip(),
        "website": str(place.get("websiteUri") or "").strip(),
        "reviews": _reviews_for_ingest(place),
        "is_listed": True,
    }


def collect_place_ids(
    api_key: str,
    *,
    center_lat: float = EDISON_LAT,
    center_lng: float = EDISON_LNG,
    radius_m: float | None = None,
    search_specs: list[tuple[str, str]] | None = None,
) -> list[str]:
    seen: dict[str, None] = {}
    specs = search_specs if search_specs is not None else SEARCH_SPECS
    rm = radius_m if radius_m is not None else LOCATION_RADIUS_M
    for included_type, text_query in specs:
        token: str | None = None
        for _ in range(50):
            data = _search_text_page(
                api_key,
                text_query,
                included_type,
                token,
                center_lat=center_lat,
                center_lng=center_lng,
                radius_m=rm,
            )
            places = data.get("places") or []
            if not isinstance(places, list):
                break
            for p in places:
                if not isinstance(p, dict):
                    continue
                pid = _norm_place_id(str(p.get("id") or ""))
                if pid and pid not in seen:
                    seen[pid] = None
            token = data.get("nextPageToken")
            if not token:
                break
            time.sleep(2.0)
        time.sleep(0.35)
    return list(seen.keys())


def fetch_records_for_place_ids(
    api_key: str,
    place_ids: list[str],
    *,
    town_fallback: str = "Edison",
    county_fallback: str = "Middlesex",
    state_fallback: str = "NJ",
    pid_fallbacks: dict[str, tuple[str, str]] | None = None,
) -> list[dict[str, Any]]:
    """Place details + source rows; optional per-place (town, county) fallbacks."""
    records: list[dict[str, Any]] = []
    n = len(place_ids)
    for i, pid in enumerate(place_ids):
        place = _place_details(api_key, pid)
        tf, cf = (town_fallback, county_fallback)
        if pid_fallbacks and pid in pid_fallbacks:
            tf, cf = pid_fallbacks[pid]
        records.append(
            _place_to_source_row(place, town_fallback=tf, county_fallback=cf, state_fallback=state_fallback),
        )
        if (i + 1) % 10 == 0:
            print(f"  details {i + 1}/{n}", flush=True)
        time.sleep(0.2)
    return records


def fetch_all_records(api_key: str) -> list[dict[str, Any]]:
    ids = collect_place_ids(api_key)
    return fetch_records_for_place_ids(api_key, ids)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Edison NJ salons and ingest to leaderboard.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only write data/edison-nj-salons-fetched.json (no Supabase)",
    )
    parser.add_argument("--chunk-size", type=int, default=100)
    args = parser.parse_args()

    _load_env()
    import os

    api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")

    print("Searching Places (Edison, NJ)…", flush=True)
    records = fetch_all_records(api_key)
    print(f"Fetched {len(records)} place(s).", flush=True)

    out_path = ROOT / "data" / "edison-nj-salons-fetched.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}", flush=True)

    if args.dry_run:
        print("Dry run: skip Supabase ingest.")
        return

    import ingest_salon_ai_leaderboard as ing  # noqa: WPS433 — only when writing to Supabase

    ing._load_env()
    chunk = max(1, min(500, int(args.chunk_size)))
    n, slugs = ing.ingest(records, chunk_size=chunk)
    print(f"Ingested {n} row(s). Slugs (first 10): {', '.join(slugs[:10])}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
