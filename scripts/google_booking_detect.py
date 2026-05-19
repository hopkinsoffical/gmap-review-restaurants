from __future__ import annotations

import asyncio
import os
import re
import time
from dataclasses import dataclass, asdict
from typing import Optional, Tuple

import pandas as pd
import requests
from playwright.async_api import (
    async_playwright,
    TimeoutError as PlaywrightTimeoutError,
)

GOOGLE_MAPS_API_KEY = "AIzaSyAd-J5GUvv9cDPHNTJrEMKoJxoSxQiL_mA"
PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

GMAPS_BOOKING_PATTERNS = [
    r"\bbook online\b",
    r"\bbook now\b",
    r"\bbooking\b",
    r"\bappointments?\b",
    r"\breserve\b",
    r"\breserve with google\b",
]

WEBSITE_BOOKING_PATTERNS = [
    r"\bbook now\b",
    r"\bschedule appointment\b",
    r"\bappointments?\b",
    r"\breserve\b",
    r"\bonline booking\b",
]

BOOKING_PROVIDERS = {
    "Vagaro": [r"vagaro\.com"],
    "Fresha": [r"fresha\.com"],
    "Square": [
        r"square\.site/bookings",
        r"squareup\.com/appointments",
        r"appointments\.squareup\.com",
    ],
    "Booksy": [r"booksy\.com"],
}


@dataclass
class DetectionResult:
    place_id: str
    place_name: str
    formatted_address: str
    google_maps_uri: str
    website_uri: str
    detection_status: str
    gmaps_booking_hit: str
    gmaps_matched_text: str
    website_booking_hit: str
    website_provider: str
    website_matched_text: str
    confidence: str
    notes: str
    error: str


def get_place_details(place_id: str) -> dict:
    if not GOOGLE_MAPS_API_KEY:
        raise ValueError("Missing GOOGLE_MAPS_API_KEY environment variable.")

    url = PLACE_DETAILS_URL.format(place_id=place_id)
    headers = {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": ",".join(
            [
                "id",
                "displayName",
                "formattedAddress",
                "googleMapsUri",
                "websiteUri",
            ]
        ),
    }

    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


async def extract_page_text(
    page, url: str, timeout_ms: int = 45000
) -> Tuple[Optional[str], str]:
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        await page.wait_for_timeout(4000)
        text = await page.locator("body").inner_text(timeout=10000)
        return text, ""
    except PlaywrightTimeoutError:
        return None, "Timed out loading page"
    except Exception as e:
        return None, f"Browser error: {e}"


def match_patterns(text: str, patterns: list[str]) -> str:
    text_norm = re.sub(r"\s+", " ", text).strip().lower()
    for pat in patterns:
        m = re.search(pat, text_norm, flags=re.IGNORECASE)
        if m:
            return m.group(0)
    return ""


def detect_provider(html_or_text: str) -> Tuple[str, str]:
    lower_text = html_or_text.lower()
    for provider, patterns in BOOKING_PROVIDERS.items():
        for pat in patterns:
            m = re.search(pat, lower_text, flags=re.IGNORECASE)
            if m:
                return provider, m.group(0)
    return "", ""


def classify_result(
    gmaps_hit: Optional[bool],
    website_hit: Optional[bool],
    provider: str,
    gmaps_text: str,
    website_text: str,
    gmaps_error: str,
    website_error: str,
    website_uri: str,
) -> Tuple[str, str, str]:
    """
    Returns: (detection_status, confidence, notes)
    """
    notes = []

    if gmaps_hit is True:
        notes.append("Google Maps booking UI matched")
        return "BOOKING_ENABLED", "high", "; ".join(notes)

    if website_hit is True or provider:
        if provider:
            notes.append(f"Website booking provider detected: {provider}")
        else:
            notes.append("Website booking-related text matched")
        return "BOOKING_ENABLED", "medium", "; ".join(notes)

    if (gmaps_hit is False) and website_uri and (website_hit is False):
        notes.append("No booking signal found on Google Maps or website")
        return "NO_BOOKING_FOUND", "medium", "; ".join(notes)

    if not website_uri:
        notes.append("No website URI available")
    if gmaps_error:
        notes.append(f"Google Maps check issue: {gmaps_error}")
    if website_error:
        notes.append(f"Website check issue: {website_error}")

    return "UNKNOWN_NEEDS_REVIEW", "low", "; ".join(notes)


async def detect_gmaps_booking(
    page, google_maps_uri: str
) -> Tuple[Optional[bool], str, str]:
    if not google_maps_uri:
        return None, "", "Missing google_maps_uri"

    text, error = await extract_page_text(page, google_maps_uri)
    if text is None:
        return None, "", error

    matched = match_patterns(text, GMAPS_BOOKING_PATTERNS)
    if matched:
        return True, matched, ""

    return False, "", ""


async def detect_website_booking(
    page, website_uri: str
) -> Tuple[Optional[bool], str, str, str]:
    """
    Returns:
        website_hit, provider, matched_text, error
    """
    if not website_uri:
        return None, "", "", "Missing website_uri"

    text, error = await extract_page_text(page, website_uri, timeout_ms=30000)
    if text is None:
        return None, "", "", error

    provider, provider_match = detect_provider(text)
    if provider:
        return True, provider, provider_match, ""

    matched = match_patterns(text, WEBSITE_BOOKING_PATTERNS)
    if matched:
        return True, "", matched, ""

    return False, "", "", ""


async def process_place_ids() -> None:
    df = pd.read_csv("databricks_notebook/skynet/nj_nail_placeid.csv")
    if "place_id" not in df.columns:
        raise ValueError("Input CSV must contain a 'place_id' column.")

    results: list[DetectionResult] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(locale="en-US")
        page = await context.new_page()

        for _, row in df.iterrows():
            place_id = str(row["place_id"]).strip()

            result = DetectionResult(
                place_id=place_id,
                place_name="",
                formatted_address="",
                google_maps_uri="",
                website_uri="",
                detection_status="UNKNOWN_NEEDS_REVIEW",
                gmaps_booking_hit="Unknown",
                gmaps_matched_text="",
                website_booking_hit="Unknown",
                website_provider="",
                website_matched_text="",
                confidence="low",
                notes="",
                error="",
            )

            try:
                details = get_place_details(place_id)
                result.place_name = details.get("displayName", {}).get("text", "")
                result.formatted_address = details.get("formattedAddress", "")
                result.google_maps_uri = details.get("googleMapsUri", "")
                result.website_uri = details.get("websiteUri", "")

                gmaps_hit, gmaps_text, gmaps_error = await detect_gmaps_booking(
                    page, result.google_maps_uri
                )
                if gmaps_hit is True:
                    result.gmaps_booking_hit = "True"
                elif gmaps_hit is False:
                    result.gmaps_booking_hit = "False"
                result.gmaps_matched_text = gmaps_text

                website_hit, provider, website_text, website_error = (
                    await detect_website_booking(page, result.website_uri)
                )
                if website_hit is True:
                    result.website_booking_hit = "True"
                elif website_hit is False:
                    result.website_booking_hit = "False"
                result.website_provider = provider
                result.website_matched_text = website_text

                status, confidence, notes = classify_result(
                    gmaps_hit=gmaps_hit,
                    website_hit=website_hit,
                    provider=provider,
                    gmaps_text=gmaps_text,
                    website_text=website_text,
                    gmaps_error=gmaps_error,
                    website_error=website_error,
                    website_uri=result.website_uri,
                )

                result.detection_status = status
                result.confidence = confidence
                result.notes = notes

                errors = [e for e in [gmaps_error, website_error] if e]
                result.error = " | ".join(errors)

                await page.wait_for_timeout(1200)
                time.sleep(0.2)

            except requests.HTTPError as e:
                result.error = f"Places API HTTP error: {e}"
            except Exception as e:
                result.error = str(e)

            results.append(result)

        await context.close()
        await browser.close()

    out_df = pd.DataFrame([asdict(r) for r in results])
    out_df.to_csv("booking_detection_results.csv", index=False)
    print(f"Saved results to booking_detection_results.csv")


if __name__ == "__main__":
    asyncio.run(process_place_ids())
