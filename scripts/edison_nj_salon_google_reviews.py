"""
Google Maps salon reviews for Edison, NJ → CSV/JSON + optional Supabase ingest.

Forked from data-transformation/.../nail_scraper_more_414.py with:
  • Default search terms covering multiple Maps queries (salon / nail / hair) in Edison
  • Per-review salon_google_url, search_city, row_fingerprint (dedupe in DB)
  • Per-salon: salon_phone, salon_website, salon_instagram (from Maps overview; best-effort)
  • --max-reviews 0 = no per-salon cap (scroll until exhaustion)
  • --ingest: upsert rows into public.edison_nj_salon_google_reviews (run sql/022 first)

Requirements:
  pip install playwright langdetect tqdm python-dotenv supabase
  playwright install chromium

Examples:
  python3 scripts/edison_nj_salon_google_reviews.py --workers 2 --ingest
  python3 scripts/edison_nj_salon_google_reviews.py --ingest-only -i data/edison_reviews.csv
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import logging
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set
import datetime as dt

_SCRIPTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPTS_DIR.parent
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(_REPO_ROOT / ".playwright-browsers"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default Maps search phrases for Edison (multiple queries → more unique salons)
# ---------------------------------------------------------------------------
DEFAULT_EDISON_SEARCH_TERMS = [
    "salon Edison NJ",
    "nail salon Edison NJ",
    "hair salon Edison NJ",
    "beauty salon Edison NJ",
]

# Legacy NJ list (only used with --legacy-nj-statewide)
NJ_CITIES = [
    "North Bergen NJ",
    "Fort Lee NJ",
    "Palisades Park NJ",
    "Westfield NJ",
    "Summit NJ",
    "Millburn NJ",
    "New Brunswick NJ",
]

# City lists for other states
STATE_CITY_TEMPLATES: Dict[str, List[str]] = {
    "New York": [
        # NYC borough-level search terms (better Maps coverage than "New York NY" alone)
        "Manhattan NY",
        "Brooklyn NY",
        "Queens NY",
        "Bronx NY",
        "Staten Island NY",
        # New York incorporated cities (statewide)
        "Albany NY",
        "Amsterdam NY",
        "Auburn NY",
        "Batavia NY",
        "Beacon NY",
        "Binghamton NY",
        "Buffalo NY",
        "Canandaigua NY",
        "Cohoes NY",
        "Corning NY",
        "Cortland NY",
        "Dunkirk NY",
        "Elmira NY",
        "Fulton NY",
        "Geneva NY",
        "Glen Cove NY",
        "Glens Falls NY",
        "Gloversville NY",
        "Hornell NY",
        "Hudson NY",
        "Ithaca NY",
        "Jamestown NY",
        "Johnstown NY",
        "Kingston NY",
        "Lackawanna NY",
        "Little Falls NY",
        "Lockport NY",
        "Long Beach NY",
        "Mechanicville NY",
        "Middletown NY",
        "Mount Vernon NY",
        "New Rochelle NY",
        "New York NY",
        "Niagara Falls NY",
        "North Tonawanda NY",
        "Norwich NY",
        "Ogdensburg NY",
        "Olean NY",
        "Oneida NY",
        "Oneonta NY",
        "Oswego NY",
        "Peekskill NY",
        "Plattsburgh NY",
        "Port Jervis NY",
        "Poughkeepsie NY",
        "Rensselaer NY",
        "Rochester NY",
        "Rome NY",
        "Rye NY",
        "Salamanca NY",
        "Saratoga Springs NY",
        "Schenectady NY",
        "Sherrill NY",
        "Syracuse NY",
        "Tonawanda NY",
        "Troy NY",
        "Utica NY",
        "Watertown NY",
        "Watervliet NY",
        "White Plains NY",
        "Yonkers NY",
    ],
    "California": [
        "Los Angeles CA",
        "San Diego CA",
        "San Jose CA",
        "San Francisco CA",
        "Fresno CA",
        "Sacramento CA",
        "Long Beach CA",
        "Oakland CA",
        "Bakersfield CA",
        "Anaheim CA",
        "Santa Ana CA",
        "Riverside CA",
        "Stockton CA",
        "Irvine CA",
        "Fremont CA",
        "San Bernardino CA",
        "Modesto CA",
        "Fontana CA",
        "Moreno Valley CA",
        "Glendale CA",
        "Huntington Beach CA",
        "Santa Clarita CA",
        "Garden Grove CA",
        "Santa Rosa CA",
        "Oceanside CA",
        "Ontario CA",
        "Rancho Cucamonga CA",
        "Elk Grove CA",
        "Corona CA",
        "Hayward CA",
    ],
}


def get_new_york_cities() -> List[str]:
    """
    Return New York city search terms only.
    Keeps only entries explicitly ending with ' NY' as a safety guard.
    """
    ny_cities = STATE_CITY_TEMPLATES.get("New York", [])
    return [city for city in ny_cities if city.strip().upper().endswith(" NY")]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
@dataclass
class Review:
    salon_name: str = ""
    salon_address: str = ""
    salon_google_url: str = ""
    search_city: str = ""
    salon_phone: str = ""
    salon_website: str = ""
    salon_instagram: str = ""
    reviewer_name: str = ""
    reviewer_url: str = ""
    rating: Optional[float] = None
    review_text: str = ""
    relative_time: str = ""
    published_at: str = ""
    language: str = ""
    row_fingerprint: str = ""
    # Google Maps place overview (list-only scrape; empty for per-review rows)
    maps_review_count: str = ""


@dataclass
class SalonInfo:
    name: str = ""
    url: str = ""
    city: str = ""


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------
def detect_language(text: str) -> str:
    if not text or len(text.strip()) < 10:
        return "unknown"
    try:
        from langdetect import detect  # type: ignore

        return detect(text)
    except Exception:
        return "unknown"


def _review_fingerprint(r: Review) -> str:
    raw = (
        f"{r.salon_google_url}\n{r.reviewer_name}\n{r.reviewer_url}\n{r.review_text}"
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


# ---------------------------------------------------------------------------
# Relative-time to ISO date
# ---------------------------------------------------------------------------
def _relative_to_date(relative_time: str) -> str:
    if not relative_time:
        return ""
    now = datetime.utcnow()
    rt = relative_time.lower().strip()
    try:
        if "just now" in rt or "moment" in rt:
            return now.strftime("%Y-%m-%d")
        m = re.search(r"(\d+)\s+(second|minute|hour|day|week|month|year)s?", rt)
        if not m:
            return ""
        value, unit = int(m.group(1)), m.group(2)
        deltas: Dict[str, dt.timedelta] = {
            "second": dt.timedelta(seconds=value),
            "minute": dt.timedelta(minutes=value),
            "hour": dt.timedelta(hours=value),
            "day": dt.timedelta(days=value),
            "week": dt.timedelta(weeks=value),
            "month": dt.timedelta(days=value * 30),
            "year": dt.timedelta(days=value * 365),
        }
        delta = deltas.get(unit)
        if delta:
            return (now - delta).strftime("%Y-%m-%d")
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# Stable selector banks
# ---------------------------------------------------------------------------
FEED_SELECTORS = [
    'div[role="feed"]',
    'div[aria-label*="Results for"]',
    'div[aria-label*="result"]',
]
REVIEW_CONTAINER_SELECTORS = [
    "div[data-review-id]",
    'div[jsaction*="pane.review"]',
    'div[class*="jftiEf"]',
]
REVIEWER_NAME_SELECTORS = [
    'button[class*="WEBjve"] div',
    'div[class*="d4r55"]',
    'a[href*="contrib"] div[class]',
    'span[class*="TSUbDb"]',
]
REVIEW_TEXT_SELECTORS = [
    'span[jsname="bN97Pc"]',
    'span[class*="wiI7pd"]',
    'div[class*="MyEned"] span',
    'span[class*="HPa7Od"]',
]
TIME_SELECTORS = [
    'span[class*="rsqaWe"]',
    'span[aria-label*="ago"]',
    'span[class*="dehysf"]',
]
ADDRESS_SELECTORS = [
    'button[data-item-id="address"] div[class*="Io6YTe"]',
    'button[data-tooltip="Copy address"] div',
    '[aria-label*="Address:"]',
]
WEBSITE_SELECTORS = [
    'a[data-item-id="authority"]',
    'a[href^="http"][data-tooltip="Open website"]',
    'a[aria-label*="website" i]',
]
SORT_SELECTORS = [
    'button[aria-label*="Sort reviews"]',
    'button[jsaction*="sortBy"]',
]
EXPAND_SELECTORS = [
    'button[aria-label*="See more"]',
    'button[class*="w8nwRe"]',
    'button[jsaction*="review.expandReview"]',
]


# ---------------------------------------------------------------------------
# Checkpoint helpers
# ---------------------------------------------------------------------------
DEFAULT_CHECKPOINT = "edison_scrape_checkpoint.json"


def load_checkpoint(checkpoint_file: str) -> Dict:
    p = Path(checkpoint_file)
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"done_cities": [], "scraped_urls": [], "total_reviews": 0}


def save_checkpoint(
    done_cities: List[str], scraped_urls: Set[str], total: int, checkpoint_file: str
) -> None:
    data = {
        "done_cities": done_cities,
        "scraped_urls": list(scraped_urls),
        "total_reviews": total,
        "updated_at": datetime.utcnow().isoformat(),
    }
    Path(checkpoint_file).write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Single-browser worker
# ---------------------------------------------------------------------------
class BrowserWorker:
    """
    One Playwright browser instance that pulls cities from a shared queue,
    searches each city, then scrapes reviews for each new salon found.
    Multiple workers run concurrently via asyncio tasks.
    """

    def __init__(
        self,
        worker_id: int,
        city_queue: "asyncio.Queue[str]",
        result_queue: "asyncio.Queue",
        scraped_urls: Set[str],
        url_lock: asyncio.Lock,
        headless: bool = True,
        max_salons_per_city: int = 0,
        max_reviews: int = 20,
        scroll_pause: float = 2.0,
        diagnose: bool = False,
        search_prefix: str = "salon",
        use_literal_queries: bool = False,
        review_scroll_rounds: int = 120,
        list_only: bool = False,
    ) -> None:
        self.wid = worker_id
        self.city_queue = city_queue
        self.result_queue = result_queue
        self.scraped_urls = scraped_urls
        self.url_lock = url_lock
        self.headless = headless
        self.max_salons_per_city = max_salons_per_city
        self.max_reviews = max_reviews
        self.scroll_pause = scroll_pause
        self.diagnose = diagnose
        self.search_prefix = search_prefix
        self.use_literal_queries = use_literal_queries
        self.review_scroll_rounds = review_scroll_rounds
        self.list_only = list_only
        self._pw = None
        self._browser = None
        self._context = None

    async def start(self) -> None:
        from playwright.async_api import async_playwright  # type: ignore

        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        self._context = await self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="America/New_York",
            viewport={"width": 1366, "height": 768},
        )
        await self._context.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
        )
        log.info("[W%d] Browser started", self.wid)

    async def stop(self) -> None:
        try:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass
        log.info("[W%d] Stopped", self.wid)

    async def _new_page(self):
        return await self._context.new_page()

    # --- main loop ---

    async def run(self) -> None:
        await self.start()
        try:
            while True:
                try:
                    city = self.city_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                try:
                    salons = await self._search_city(city)

                    # Dedup: only keep salons we haven't scraped yet
                    new_salons: List[SalonInfo] = []
                    async with self.url_lock:
                        for s in salons:
                            if s.url not in self.scraped_urls:
                                self.scraped_urls.add(s.url)
                                new_salons.append(s)

                    log.info(
                        "[W%d] %s → %d found, %d new",
                        self.wid,
                        city,
                        len(salons),
                        len(new_salons),
                    )

                    for salon in new_salons:
                        if self.list_only:
                            reviews = await self._scrape_listing_snapshot(salon)
                        else:
                            reviews = await self._scrape_reviews(salon)
                        if reviews:
                            await self.result_queue.put((city, salon, reviews))

                    self.city_queue.task_done()
                    # List-only: less cooldown between city searches; full review scrape needs more settling time.
                    await asyncio.sleep(self.scroll_pause * (0.15 if self.list_only else 0.5))

                except Exception as exc:
                    log.error("[W%d] City error (%s): %s", self.wid, city, exc)
                    self.city_queue.task_done()
        finally:
            await self.stop()

    # --- cookie banner ---

    async def _accept_cookies(self, page) -> None:
        for sel in [
            'form[action*="consent"] button',
            'button[aria-label*="Accept all"]',
            "#L2AGLb",
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
        ]:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=1500):
                    await btn.click()
                    await asyncio.sleep(0.45 if self.list_only else 1.0)
                    return
            except Exception:
                pass

    # --- city search ---

    async def _search_city(self, city: str) -> List[SalonInfo]:
        if self.use_literal_queries:
            query = city.strip()
        else:
            query = f"{self.search_prefix} {city}".strip()
        url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
        page = await self._new_page()
        salons: List[SalonInfo] = []
        seen_hrefs: Set[str] = set()

        try:
            await page.goto(url, timeout=60_000, wait_until="domcontentloaded")
            await self._accept_cookies(page)

            # Wait for results feed
            feed_found = False
            for sel in FEED_SELECTORS:
                try:
                    await page.wait_for_selector(sel, timeout=12000, state="visible")
                    feed_found = True
                    break
                except Exception:
                    pass

            if not feed_found:
                log.warning("[W%d] No feed for: %s", self.wid, city)
                return salons

            await asyncio.sleep(0.55 if self.list_only else 1.5)

            stagnant_rounds = 0
            stagnant_cap = 4 if self.list_only else 5
            for _round in range(200):
                before_count = len(salons)
                anchors = await page.query_selector_all('a[href*="/maps/place/"]')
                for a in anchors:
                    href = await a.get_attribute("href")
                    if not href or href in seen_hrefs:
                        continue
                    seen_hrefs.add(href)
                    clean = re.sub(r"&.*", "", href)
                    name = await self._extract_name(a)
                    if name:
                        salons.append(SalonInfo(name=name, url=clean, city=city))

                if self.max_salons_per_city > 0 and len(salons) >= self.max_salons_per_city:
                    break

                # End-of-list detection
                end_el = await page.query_selector(
                    'span[class*="HlvSq"], p[class*="fontBodyMedium"] > span'
                )
                if end_el:
                    txt = (await end_el.inner_text()).lower()
                    if "end of list" in txt or "no more" in txt:
                        break

                # Scroll the feed
                scrolled = False
                for fsel in FEED_SELECTORS:
                    try:
                        panel = await page.query_selector(fsel)
                        if panel:
                            before = await panel.evaluate("el => el.scrollTop")
                            await panel.evaluate("el => el.scrollBy(0, 900)")
                            await asyncio.sleep(self.scroll_pause * (0.22 if self.list_only else 0.4))
                            after = await panel.evaluate("el => el.scrollTop")
                            scrolled = after != before
                            break
                    except Exception:
                        pass
                if not scrolled:
                    break

                if len(salons) == before_count:
                    stagnant_rounds += 1
                    if stagnant_rounds >= stagnant_cap:
                        break
                else:
                    stagnant_rounds = 0

        except Exception as exc:
            log.error("[W%d] _search_city error (%s): %s", self.wid, city, exc)
        finally:
            await page.close()

        if self.max_salons_per_city > 0:
            return salons[: self.max_salons_per_city]
        return salons

    async def _extract_name(self, anchor_el) -> str:
        for sel in [
            "div.fontHeadlineSmall",
            "div[class*='fontHeadlineSmall']",
            "div[class*='qBF1Pd']",
            "div[class*='NrDZNb']",
        ]:
            try:
                el = await anchor_el.query_selector(sel)
                if el:
                    t = (await el.inner_text()).strip()
                    if t:
                        return t
            except Exception:
                pass
        try:
            label = await anchor_el.get_attribute("aria-label")
            if label:
                return label.strip()
        except Exception:
            pass
        try:
            divs = await anchor_el.query_selector_all("div")
            for d in divs[:5]:
                t = (await d.inner_text()).strip()
                if 3 < len(t) < 80 and "\n" not in t:
                    return t
        except Exception:
            pass
        return ""

    async def _extract_salon_contact(self, page) -> tuple[str, str, str]:
        """
        Read phone, official website, and Instagram from the place overview panel.
        Maps layout changes often; we use several fallbacks.
        """
        phone, website, instagram = "", "", ""

        try:
            for a in await page.query_selector_all('a[href^="tel:"]'):
                href = (await a.get_attribute("href")) or ""
                if href.startswith("tel:"):
                    raw = href[4:].strip()
                    if raw:
                        phone = raw
                        break
            if not phone:
                btn = await page.query_selector('button[data-item-id="phone"]')
                if btn:
                    t = (await btn.inner_text()).strip()
                    if t:
                        phone = t
        except Exception:
            pass

        try:
            for sel in WEBSITE_SELECTORS:
                el = await page.query_selector(sel)
                if not el:
                    continue
                href = (await el.get_attribute("href")) or ""
                if href.startswith("http") and "google.com" not in href:
                    website = href.split("?", 1)[0].strip()
                    break
        except Exception:
            pass

        try:
            skip = {
                "p",
                "reel",
                "reels",
                "stories",
                "explore",
                "tv",
                "accounts",
            }
            for a in await page.query_selector_all('a[href*="instagram.com"]'):
                href = (await a.get_attribute("href")) or ""
                m = re.search(
                    r"instagram\.com/([A-Za-z0-9._]+)/?(?:\?|#|$)", href, re.I
                )
                if not m:
                    continue
                user = m.group(1)
                if user.lower() in skip:
                    continue
                instagram = f"https://www.instagram.com/{user}/"
                break
        except Exception:
            pass

        return phone, website, instagram

    async def _overview_rating_and_count(self, page) -> tuple[Optional[float], int]:
        """Star rating and total Google review count from the place overview (no Reviews tab)."""
        rating: Optional[float] = None
        count = 0
        try:
            for el in await page.query_selector_all('[aria-label*="star" i]'):
                label = (await el.get_attribute("aria-label")) or ""
                m = re.search(
                    r"([\d.]+)\s*(?:out of\s*5|stars?)", label, re.I
                ) or re.search(r"([\d.]+)\s*star", label, re.I)
                if m:
                    v = float(m.group(1).replace(",", "."))
                    if 0 <= v <= 5:
                        rating = v
                        break
        except Exception:
            pass
        try:
            for el in await page.query_selector_all("[aria-label]"):
                label = (await el.get_attribute("aria-label")) or ""
                m = re.search(r"([\d,\s]+)\s+reviews?\b", label, re.I)
                if m:
                    raw = m.group(1).replace(",", "").replace(" ", "")
                    if raw.isdigit():
                        count = max(count, int(raw))
        except Exception:
            pass
        if count == 0:
            try:
                txt = await page.inner_text("body")
                m = re.search(r"\(([\d,]+)\)\s*\n?\s*Reviews?\b", txt, re.I)
                if m:
                    count = int(m.group(1).replace(",", ""))
            except Exception:
                pass
        return rating, count

    async def _scrape_listing_snapshot(self, salon: SalonInfo) -> List[Review]:
        """Open place page, read overview fields + aggregate rating/count; skip review feed."""
        page = await self._new_page()
        salon_name = salon.name
        salon_address = ""
        salon_phone, salon_website, salon_instagram = "", "", ""
        rating: Optional[float] = None
        maps_count = 0
        try:
            await page.goto(salon.url, timeout=60_000, wait_until="domcontentloaded")
            await self._accept_cookies(page)
            try:
                await page.wait_for_selector("h1", timeout=6000, state="visible")
            except Exception:
                pass
            await asyncio.sleep(0.22)
            try:
                h1 = await page.query_selector("h1")
                if h1:
                    t = (await h1.inner_text()).strip()
                    if t:
                        salon_name = t
            except Exception:
                pass
            for sel in ADDRESS_SELECTORS:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t and len(t) > 5:
                            salon_address = t
                            break
                except Exception:
                    pass
            salon_phone, salon_website, salon_instagram = await self._extract_salon_contact(
                page
            )
            rating, maps_count = await self._overview_rating_and_count(page)
        except Exception as exc:
            log.debug("[W%d] _scrape_listing_snapshot (%s): %s", self.wid, salon.name, exc)
        finally:
            await page.close()

        r = Review(
            salon_name=salon_name or salon.name,
            salon_address=salon_address,
            salon_phone=salon_phone,
            salon_website=salon_website,
            salon_instagram=salon_instagram,
            reviewer_name="(listing)",
            reviewer_url="",
            rating=rating,
            review_text="",
            relative_time="",
            published_at="",
            language="",
            maps_review_count=str(maps_count),
        )
        r.salon_google_url = salon.url
        r.search_city = salon.city
        r.row_fingerprint = _review_fingerprint(r)
        return [r]

    # --- individual salon reviews ---

    async def _scrape_reviews(self, salon: SalonInfo) -> List[Review]:
        page = await self._new_page()
        reviews: List[Review] = []
        salon_name = salon.name
        salon_address = ""
        salon_phone, salon_website, salon_instagram = "", "", ""

        try:
            await page.goto(salon.url, timeout=60_000, wait_until="domcontentloaded")
            await self._accept_cookies(page)
            await asyncio.sleep(1.5)

            # Canonical name from H1
            try:
                h1 = await page.query_selector("h1")
                if h1:
                    t = (await h1.inner_text()).strip()
                    if t:
                        salon_name = t
            except Exception:
                pass

            # Address
            for sel in ADDRESS_SELECTORS:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t and len(t) > 5:
                            salon_address = t
                            break
                except Exception:
                    pass

            salon_phone, salon_website, salon_instagram = await self._extract_salon_contact(
                page
            )

            if not await self._open_reviews_tab(page):
                return reviews
            await asyncio.sleep(1.5)

            await self._sort_newest(page)
            await asyncio.sleep(1.5)

            seen: Set[str] = set()
            for _scroll in range(self.review_scroll_rounds):
                containers: list = []
                for sel in REVIEW_CONTAINER_SELECTORS:
                    containers = await page.query_selector_all(sel)
                    if containers:
                        break

                for container in containers:
                    r = await self._parse_review(container, salon_name, salon_address)
                    if r:
                        key = r.reviewer_name + r.review_text[:30]
                        if key not in seen:
                            seen.add(key)
                            reviews.append(r)

                if self.max_reviews > 0 and len(reviews) >= self.max_reviews:
                    break

                at_bottom = await self._scroll_reviews(page)
                if at_bottom:
                    break
                await asyncio.sleep(self.scroll_pause * 0.6)

        except Exception as exc:
            log.debug("[W%d] _scrape_reviews error (%s): %s", self.wid, salon.name, exc)
        finally:
            await page.close()

        for r in reviews:
            r.salon_google_url = salon.url
            r.search_city = salon.city
            r.salon_phone = salon_phone
            r.salon_website = salon_website
            r.salon_instagram = salon_instagram
            r.row_fingerprint = _review_fingerprint(r)

        if self.max_reviews > 0:
            return reviews[: self.max_reviews]
        return reviews

    async def _open_reviews_tab(self, page) -> bool:
        try:
            btn = page.locator('button[aria-label*="reviews" i]').first
            if await btn.is_visible(timeout=4000):
                await btn.click()
                await asyncio.sleep(1.2)
                return True
        except Exception:
            pass
        try:
            btn = page.get_by_role("tab", name=re.compile(r"review", re.I)).first
            if await btn.is_visible(timeout=3000):
                await btn.click()
                await asyncio.sleep(1.2)
                return True
        except Exception:
            pass
        try:
            buttons = await page.query_selector_all("button")
            for b in buttons:
                txt = (await b.inner_text()).strip()
                if re.match(r"reviews?\b", txt, re.I):
                    await b.click()
                    await asyncio.sleep(1.2)
                    return True
        except Exception:
            pass
        return False

    async def _sort_newest(self, page) -> None:
        for sel in SORT_SELECTORS:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    await asyncio.sleep(0.8)
                    items = await page.query_selector_all(
                        'li[role="menuitemradio"], div[role="menuitem"], li[role="option"]'
                    )
                    if len(items) >= 2:
                        await items[1].click()
                        await asyncio.sleep(1.2)
                    return
            except Exception:
                pass

    async def _scroll_reviews(self, page) -> bool:
        for sel in [
            'div[aria-label*="Reviews for"]',
            'div[aria-label*="reviews" i]',
            "div.m6QErb[aria-label]",
        ]:
            try:
                panel = await page.query_selector(sel)
                if not panel:
                    continue
                before = await panel.evaluate("el => el.scrollTop")
                await panel.evaluate("el => el.scrollBy(0, 1200)")
                await asyncio.sleep(0.5)
                after = await panel.evaluate("el => el.scrollTop")
                sh = await panel.evaluate("el => el.scrollHeight")
                ch = await panel.evaluate("el => el.clientHeight")
                return (after + ch + 5) >= sh
            except Exception:
                pass
        try:
            await page.evaluate("window.scrollBy(0, 1200)")
        except Exception:
            pass
        return False

    async def _parse_review(
        self, container, salon_name: str, salon_address: str
    ) -> Optional[Review]:
        try:
            reviewer_name = ""
            for sel in REVIEWER_NAME_SELECTORS:
                try:
                    el = await container.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t:
                            reviewer_name = t
                            break
                except Exception:
                    pass

            reviewer_url = ""
            try:
                link = await container.query_selector('a[href*="contrib"]')
                if link:
                    reviewer_url = (await link.get_attribute("href")) or ""
            except Exception:
                pass

            rating: Optional[float] = None
            for sel in [
                'span[role="img"][aria-label*="star"]',
                'span[aria-label*="stars"]',
            ]:
                try:
                    el = await container.query_selector(sel)
                    if el:
                        label = (await el.get_attribute("aria-label")) or ""
                        m = re.search(r"(\d+(?:[.,]\d+)?)\s*star", label, re.I)
                        if m:
                            rating = float(m.group(1).replace(",", "."))
                            break
                except Exception:
                    pass

            for sel in EXPAND_SELECTORS:
                try:
                    btn = await container.query_selector(sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await asyncio.sleep(0.3)
                        break
                except Exception:
                    pass

            review_text = ""
            for sel in REVIEW_TEXT_SELECTORS:
                try:
                    el = await container.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t:
                            review_text = t
                            break
                except Exception:
                    pass

            relative_time = ""
            for sel in TIME_SELECTORS:
                try:
                    el = await container.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t:
                            relative_time = t
                            break
                except Exception:
                    pass

            if not reviewer_name and not review_text:
                return None

            return Review(
                salon_name=salon_name,
                salon_address=salon_address,
                salon_phone="",
                salon_website="",
                salon_instagram="",
                reviewer_name=reviewer_name,
                reviewer_url=reviewer_url,
                rating=rating,
                review_text=review_text,
                relative_time=relative_time,
                published_at=_relative_to_date(relative_time),
                language=detect_language(review_text),
            )
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Output: incremental CSV writer
# ---------------------------------------------------------------------------
FIELDNAMES = [
    "salon_name",
    "salon_address",
    "salon_google_url",
    "search_city",
    "salon_phone",
    "salon_website",
    "salon_instagram",
    "reviewer_name",
    "reviewer_url",
    "rating",
    "review_text",
    "relative_time",
    "published_at",
    "language",
    "maps_review_count",
    "row_fingerprint",
]


def review_dict_for_export(r: Review) -> Dict[str, object]:
    d = asdict(r)
    if d.get("rating") is None:
        d["rating"] = ""
    return d


class IncrementalCSVWriter:
    """Appends reviews to CSV as they arrive — safe on interruption."""

    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self._f = None
        self._writer = None
        self._count = 0

    def open(self) -> None:
        exists = self.path.exists()
        self._f = self.path.open("a", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._f, fieldnames=FIELDNAMES)
        if not exists:
            self._writer.writeheader()

    def write(self, reviews: List[Review]) -> None:
        for r in reviews:
            self._writer.writerow(review_dict_for_export(r))
        self._f.flush()
        self._count += len(reviews)

    def close(self) -> None:
        if self._f:
            self._f.close()

    @property
    def count(self) -> int:
        return self._count


# ---------------------------------------------------------------------------
# Result consumer
# ---------------------------------------------------------------------------
async def result_consumer(
    result_queue: asyncio.Queue,
    csv_writer: IncrementalCSVWriter,
    all_reviews: List[Review],
    done_cities: List[str],
    scraped_urls: Set[str],
    total_cities: int,
    target_salons: int,
    stop_event: asyncio.Event,
    checkpoint_file: str,
) -> None:
    try:
        from tqdm import tqdm  # type: ignore

        pbar: Optional[object] = tqdm(
            total=total_cities, desc="Cities scraped", unit="city"
        )
    except ImportError:
        pbar = None

    last_ckpt = 0

    while not stop_event.is_set() or not result_queue.empty():
        try:
            city, salon, reviews = await asyncio.wait_for(
                result_queue.get(), timeout=1.0
            )
        except asyncio.TimeoutError:
            continue
        except Exception:
            break

        all_reviews.extend(reviews)
        csv_writer.write(reviews)

        if city not in done_cities:
            done_cities.append(city)
            if pbar:
                pbar.update(1)  # type: ignore
                pbar.set_postfix(  # type: ignore
                    salons=len(scraped_urls),
                    reviews=len(all_reviews),
                    refresh=False,
                )

        if len(done_cities) - last_ckpt >= 1:
            save_checkpoint(done_cities, scraped_urls, len(all_reviews), checkpoint_file)
            last_ckpt = len(done_cities)
            log.info(
                "Checkpoint | cities %d/%d | salons %d | reviews %d",
                len(done_cities),
                total_cities,
                len(scraped_urls),
                len(all_reviews),
            )

        result_queue.task_done()

        if len(scraped_urls) >= target_salons:
            log.info("Reached target of %d salons.", target_salons)
            stop_event.set()

    if pbar:
        pbar.close()  # type: ignore


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
async def run_scraper(args: argparse.Namespace) -> List[Review]:
    if args.legacy_nj_statewide:
        if args.state.strip().lower() not in ("new jersey", "nj"):
            log.warning(
                "Legacy NJ mode expects New Jersey. Ignoring --state=%s",
                args.state,
            )
        all_cities = list(NJ_CITIES)
        use_literal_queries = False
    elif args.search_terms:
        all_cities = list(args.search_terms)
        use_literal_queries = True
    elif args.cities:
        all_cities = list(args.cities)
        use_literal_queries = False
    else:
        all_cities = list(DEFAULT_EDISON_SEARCH_TERMS)
        use_literal_queries = True

    scraped_urls: Set[str] = set()
    done_cities: List[str] = []
    all_reviews: List[Review] = []

    if args.resume:
        ckpt = load_checkpoint(args.checkpoint)
        scraped_urls = set(ckpt.get("scraped_urls", []))
        log.info(
            "Resuming: %d salons already in checkpoint (re-queueing all searches; dedup by URL)",
            len(scraped_urls),
        )

    # Always queue every search phrase; dedup is by salon URL only (done_cities is diagnostic).
    remaining = list(all_cities)

    if not remaining:
        log.info("No search phrases configured.")
        return all_reviews

    log.info(
        "State: %s | Cities: %d | Workers: %d | Max salons/city: %d | Target: %d | list_only=%s",
        "New Jersey",
        len(remaining),
        args.workers,
        args.max_salons_per_city,
        args.target_salons,
        getattr(args, "list_only", False),
    )

    city_queue: "asyncio.Queue[str]" = asyncio.Queue()
    for city in remaining:
        await city_queue.put(city)

    result_queue: asyncio.Queue = asyncio.Queue()
    url_lock = asyncio.Lock()
    stop_event = asyncio.Event()

    out_base = Path(args.output)
    out_base.parent.mkdir(parents=True, exist_ok=True)

    csv_writer = IncrementalCSVWriter(f"{args.output}.csv")
    csv_writer.open()

    workers = [
        BrowserWorker(
            worker_id=i,
            city_queue=city_queue,
            result_queue=result_queue,
            scraped_urls=scraped_urls,
            url_lock=url_lock,
            headless=not args.no_headless,
            max_salons_per_city=args.max_salons_per_city,
            max_reviews=args.max_reviews,
            scroll_pause=args.scroll_pause,
            diagnose=args.diagnose,
            search_prefix=args.search_prefix,
            use_literal_queries=use_literal_queries,
            review_scroll_rounds=args.review_scroll_rounds,
            list_only=bool(getattr(args, "list_only", False)),
        )
        for i in range(args.workers)
    ]

    consumer = asyncio.ensure_future(
        result_consumer(
            result_queue,
            csv_writer,
            all_reviews,
            done_cities,
            scraped_urls,
            total_cities=len(remaining),
            target_salons=args.target_salons,
            stop_event=stop_event,
            checkpoint_file=args.checkpoint,
        )
    )

    try:
        await asyncio.gather(*[asyncio.ensure_future(w.run()) for w in workers])
    except KeyboardInterrupt:
        log.info("Interrupted. Saving checkpoint...")
    finally:
        stop_event.set()
        await consumer
        csv_writer.close()
        save_checkpoint(done_cities, scraped_urls, len(all_reviews), args.checkpoint)

    log.info(
        "Finished | Cities: %d | Unique salons: %d | Reviews: %d",
        len(done_cities),
        len(scraped_urls),
        len(all_reviews),
    )

    if args.format in ("json", "both"):
        jp = Path(f"{args.output}.json")
        jp.write_text(
            json.dumps([asdict(r) for r in all_reviews], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        log.info("JSON saved → %s", jp.resolve())

    log.info("CSV saved → %s", Path(f"{args.output}.csv").resolve())
    return all_reviews


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Scrape Google Maps salon reviews (Edison NJ default) and optionally load Supabase.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--state", default="New Jersey", help="(Legacy NJ mode only)")
    p.add_argument(
        "--legacy-nj-statewide",
        action="store_true",
        help="Use shortened NJ_CITIES list instead of Edison-focused searches",
    )
    p.add_argument(
        "--search-terms",
        nargs="*",
        default=None,
        help="Full Maps query strings (e.g. 'nail salon Edison NJ'). Implies literal query mode.",
    )
    p.add_argument(
        "--cities",
        nargs="*",
        default=None,
        help="City tokens used with --search-prefix, e.g. --cities 'Edison NJ'",
    )
    p.add_argument(
        "--search-prefix",
        default="salon",
        help="Prepended before each --cities entry when not using --search-terms",
    )
    p.add_argument(
        "--workers",
        type=int,
        default=2,
        help="Concurrent browser instances (default: 2)",
    )
    p.add_argument(
        "--target-salons",
        type=int,
        default=400,
        help="Stop after N unique salons (default: 400)",
    )
    p.add_argument(
        "--max-salons-per-city",
        type=int,
        default=0,
        help="Cap salons per search (0 = all)",
    )
    p.add_argument(
        "--max-reviews",
        type=int,
        default=0,
        help="Max reviews per salon (0 = no cap, default: 0)",
    )
    p.add_argument(
        "--review-scroll-rounds",
        type=int,
        default=120,
        help="Max review-panel scroll iterations per salon",
    )
    p.add_argument("--output", default="data/edison_nj_salon_reviews")
    p.add_argument("--format", choices=["csv", "json", "both"], default="both")
    p.add_argument("--scroll-pause", type=float, default=2.0)
    p.add_argument(
        "--checkpoint",
        default=DEFAULT_CHECKPOINT,
        help="Resume checkpoint JSON path",
    )
    p.add_argument("--resume", action="store_true", help="Resume from checkpoint file")
    p.add_argument("--no-headless", action="store_true")
    p.add_argument("--diagnose", action="store_true")
    p.add_argument(
        "--list-only",
        action="store_true",
        help=(
            "Only collect salon/spa listing fields from each place page (name, address, phone, "
            "website, Instagram, Maps rating & review count). Do not open or scroll the Reviews tab."
        ),
    )
    p.add_argument(
        "--cities-only",
        action="store_true",
        help="Print queued search list and exit",
    )
    p.add_argument(
        "--ingest",
        action="store_true",
        help="After scrape, upsert CSV rows into Supabase (requires env + sql/022 migration)",
    )
    p.add_argument(
        "--ingest-only",
        action="store_true",
        help="Skip Playwright; only read --ingest-csv and upsert to Supabase",
    )
    p.add_argument(
        "--ingest-csv",
        default=None,
        help="CSV path for --ingest-only (defaults to {output}.csv)",
    )
    p.add_argument(
        "--ingest-batch-size",
        type=int,
        default=400,
        help="Rows per Supabase upsert batch",
    )
    return p


ROOT = Path(__file__).resolve().parents[1]
SUPABASE_TABLE = "edison_nj_salon_google_reviews"


def _load_env() -> None:
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(ROOT / ".env.local")
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass


def _parse_rating_csv(val: object) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def _csv_row_to_supabase_payload(row: Dict[str, str]) -> Dict[str, object]:
    fp = (row.get("row_fingerprint") or "").strip()
    if not fp:
        raw = (
            f"{row.get('salon_google_url', '')}\n"
            f"{row.get('reviewer_name', '')}\n"
            f"{row.get('reviewer_url', '')}\n"
            f"{row.get('review_text', '')}"
        )
        fp = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    pub = (row.get("published_at") or "").strip()
    scraped = datetime.now(timezone.utc).isoformat()
    return {
        "row_fingerprint": fp,
        "salon_google_url": (row.get("salon_google_url") or "").strip(),
        "search_city": (row.get("search_city") or "").strip(),
        "salon_name": (row.get("salon_name") or "").strip(),
        "salon_address": (row.get("salon_address") or "").strip(),
        "salon_phone": (row.get("salon_phone") or "").strip(),
        "salon_website": (row.get("salon_website") or "").strip(),
        "salon_instagram": (row.get("salon_instagram") or "").strip(),
        "reviewer_name": (row.get("reviewer_name") or "").strip(),
        "reviewer_url": (row.get("reviewer_url") or "").strip(),
        "rating": _parse_rating_csv(row.get("rating")),
        "review_text": row.get("review_text") or "",
        "relative_time": (row.get("relative_time") or "").strip(),
        "published_at": pub if pub else None,
        "language": (row.get("language") or "").strip() or "unknown",
        "scraped_at": scraped,
    }


def ingest_reviews_csv(csv_path: Path, batch_size: int = 400) -> int:
    try:
        from supabase import create_client  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Install supabase: pip install -r pipelines/requirements.txt"
        ) from exc

    _load_env()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    if not csv_path.is_file():
        raise RuntimeError(f"CSV not found: {csv_path}")

    client = create_client(url, key)
    batch: List[Dict[str, object]] = []
    total = 0
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            batch.append(_csv_row_to_supabase_payload(row))
            if len(batch) >= batch_size:
                client.table(SUPABASE_TABLE).upsert(
                    batch, on_conflict="row_fingerprint"
                ).execute()
                total += len(batch)
                log.info("Upserted %d rows (running total %d)", len(batch), total)
                batch = []
        if batch:
            client.table(SUPABASE_TABLE).upsert(
                batch, on_conflict="row_fingerprint"
            ).execute()
            total += len(batch)
            log.info("Upserted %d rows (running total %d)", len(batch), total)
    return total


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.ingest_only:
        csv_path = Path(
            args.ingest_csv or (args.output + ".csv"),
        )
        try:
            n = ingest_reviews_csv(csv_path, batch_size=args.ingest_batch_size)
            log.info("Ingest complete: %d rows from %s", n, csv_path)
        except Exception as exc:
            log.error("%s", exc)
            sys.exit(1)
        return

    if args.cities_only:
        if args.legacy_nj_statewide:
            cities = list(NJ_CITIES)
        elif args.search_terms:
            cities = list(args.search_terms)
        elif args.cities:
            cities = list(args.cities)
        else:
            cities = list(DEFAULT_EDISON_SEARCH_TERMS)
        print(f"\n{len(cities)} searches queued:")
        for i, c in enumerate(cities, 1):
            print(f"  {i:3d}. {c}")
        return

    _ = asyncio.run(run_scraper(args))
    if args.ingest:
        csv_path = Path(args.output + ".csv")
        try:
            n = ingest_reviews_csv(csv_path, batch_size=args.ingest_batch_size)
            log.info("Supabase ingest: %d rows from %s", n, csv_path)
        except Exception as exc:
            log.error("Ingest failed: %s", exc)
            sys.exit(1)


if __name__ == "__main__":
    main()
