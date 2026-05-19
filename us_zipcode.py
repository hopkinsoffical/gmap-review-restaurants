#!/usr/bin/env python3
"""
Download US ZCTA (ZIP Code Tabulation Area) total population from Census ACS 5-year.

Public API: https://api.census.gov/data/{year}/acs/acs5
Variable B01003_001E = total population (estimate).

No API key required (optional; higher rate limits with key):
  export CENSUS_API_KEY=...   # or pass --api-key

Default output: data/us_zipcode_population_{year}.csv
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT_SUBDIR = "data"
ZCTA_COUNTY_REL_2020_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
)


def fetch_zcta_population(year: int, api_key: str | None, timeout: float) -> tuple[list[str], list[list[str]]]:
    base_url = f"https://api.census.gov/data/{year}/acs/acs5"
    params: dict[str, str] = {
        "get": "NAME,B01003_001E",
        "for": "zip code tabulation area:*",
    }
    if api_key:
        params["key"] = api_key

    r = requests.get(base_url, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list) or len(data) < 2:
        raise ValueError("Unexpected Census API response shape")
    headers = data[0]
    rows = data[1:]
    if not isinstance(headers, list):
        raise ValueError("Invalid headers from Census API")
    return [str(h) for h in headers], rows


def fetch_state_name_map(year: int, api_key: str | None, timeout: float) -> dict[str, str]:
    base_url = f"https://api.census.gov/data/{year}/acs/acs5"
    params: dict[str, str] = {
        "get": "NAME",
        "for": "state:*",
    }
    if api_key:
        params["key"] = api_key

    r = requests.get(base_url, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list) or len(data) < 2:
        raise ValueError("Unexpected Census state API response shape")

    out: dict[str, str] = {}
    for rec in data[1:]:
        if not isinstance(rec, list) or len(rec) < 2:
            continue
        state_name = str(rec[0]).strip()
        state_fips = str(rec[1]).strip()
        if state_fips:
            out[state_fips] = state_name
    return out


def fetch_primary_zcta_county_map(timeout: float) -> dict[str, dict[str, str]]:
    """Return one county per ZCTA, chosen by max land overlap with the ZIP polygon."""
    r = requests.get(ZCTA_COUNTY_REL_2020_URL, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()

    text = r.content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter="|")
    best_by_zcta: dict[str, tuple[int, int, str, str]] = {}

    for row in reader:
        zcta = str(row.get("GEOID_ZCTA5_20") or "").strip()
        county_geoid = str(row.get("GEOID_COUNTY_20") or "").strip()
        county_name = str(row.get("NAMELSAD_COUNTY_20") or "").strip()
        if not zcta or not county_geoid:
            continue

        try:
            area_land_part = int(str(row.get("AREALAND_PART") or "0").strip() or "0")
        except ValueError:
            area_land_part = 0
        try:
            area_water_part = int(str(row.get("AREAWATER_PART") or "0").strip() or "0")
        except ValueError:
            area_water_part = 0

        candidate = (area_land_part, area_water_part, county_geoid, county_name)
        current = best_by_zcta.get(zcta)
        if current is None or candidate > current:
            best_by_zcta[zcta] = candidate

    out: dict[str, dict[str, str]] = {}
    for zcta, (_land, _water, county_geoid, county_name) in best_by_zcta.items():
        out[zcta] = {
            "state_fips": county_geoid[:2],
            "county_fips": county_geoid[2:],
            "county": county_name,
        }
    return out


def main() -> int:
    p = argparse.ArgumentParser(description="Download ZCTA population CSV from US Census ACS5.")
    p.add_argument("--year", type=int, default=2020, help="ACS release year (dataset year, default 2020)")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help=f"Output CSV path (default: {DEFAULT_OUT_SUBDIR}/us_zipcode_population_<year>.csv under repo root)",
    )
    p.add_argument("--api-key", default="", help="Census API key (or set CENSUS_API_KEY)")
    p.add_argument("--timeout", type=float, default=120.0, help="HTTP timeout seconds")
    args = p.parse_args()

    year = int(args.year)
    api_key = (args.api_key or os.environ.get("CENSUS_API_KEY") or "").strip() or None
    out = args.output
    if out is None:
        out = ROOT / DEFAULT_OUT_SUBDIR / f"us_zipcode_population_{year}.csv"
    else:
        out = Path(out)
        if not out.is_absolute():
            out = ROOT / out

    print(f"Downloading ZCTA population (ACS5 {year}) from Census API…")
    headers, records = fetch_zcta_population(year, api_key, args.timeout)
    print("Downloading state names from Census API…")
    state_name_map = fetch_state_name_map(year, api_key, args.timeout)
    print("Downloading ZCTA-to-county relationship file…")
    zcta_county_map = fetch_primary_zcta_county_map(args.timeout)

    try:
        idx_name = headers.index("NAME")
        idx_pop = headers.index("B01003_001E")
        idx_zcta = headers.index("zip code tabulation area")
    except ValueError as e:
        print(f"Unexpected columns: {headers}", file=sys.stderr)
        raise SystemExit(1) from e

    out.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "zcta5",
                "zipcode",
                "name",
                "state",
                "county",
                "state_fips",
                "county_fips",
                "population",
                "acs_year",
            ]
        )
        for rec in records:
            if len(rec) <= max(idx_name, idx_pop, idx_zcta):
                continue
            zcta = str(rec[idx_zcta]).strip()
            name = str(rec[idx_name]).strip()
            county_info = zcta_county_map.get(zcta, {})
            state_fips = str(county_info.get("state_fips") or "").strip()
            county_fips = str(county_info.get("county_fips") or "").strip()
            state_name = state_name_map.get(state_fips, "")
            county_name = str(county_info.get("county") or "").strip()
            pop_raw = rec[idx_pop]
            try:
                population = int(pop_raw) if pop_raw is not None and str(pop_raw) not in ("", "null") else None
            except (TypeError, ValueError):
                population = None
            w.writerow(
                [
                    zcta,
                    zcta,
                    name,
                    state_name,
                    county_name,
                    state_fips,
                    county_fips,
                    population if population is not None else "",
                    year,
                ]
            )
            written += 1

    print("DONE")
    print(f"Rows: {written:,}")
    print(f"Saved: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
