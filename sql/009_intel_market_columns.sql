-- Market intel / scraped salon fields for the public Analysis Reports platform.
-- Run after 001–008. Safe to re-run (IF NOT EXISTS / idempotent updates).

alter table public.stores
  add column if not exists address text not null default '';

alter table public.stores
  add column if not exists city text not null default '';

alter table public.stores
  add column if not exists township text not null default '';

alter table public.stores
  add column if not exists google_rating numeric(4, 2);

alter table public.stores
  add column if not exists google_review_count integer;

alter table public.stores
  add column if not exists marketing_score numeric(8, 2);

alter table public.stores
  add column if not exists intel_report jsonb not null default '{}'::jsonb;

alter table public.stores
  add column if not exists intel_listed boolean not null default false;

create index if not exists stores_intel_listed_idx
  on public.stores (intel_listed)
  where intel_listed = true;

create index if not exists stores_township_intel_idx
  on public.stores (township)
  where intel_listed = true and nullif(trim(township), '') is not null;

-- Seed / refresh demo intel for Garwood-area nail salons (adjust in production).
update public.stores
set
  address = '400 South Ave, Garwood, NJ 07027, USA',
  city = 'Garwood',
  township = 'Garwood Borough, NJ',
  google_rating = 4.8,
  google_review_count = 312,
  marketing_score = 78.5,
  intel_listed = true,
  intel_report = '{
    "reviewSentiment": {"positivePct": 82, "neutralPct": 12, "negativePct": 6},
    "sentimentBenchmark": {"townshipPositivePct": 79, "note": "Township average review tone is slightly more mixed than this salon."},
    "salonReviews": [
      {"date": "2025-03-12", "rating": 5, "text": "Consistent quality and the space feels calm. Booking was easy and the result lasted."},
      {"date": "2025-02-02", "rating": 5, "text": "Technician took time on shaping and the gel still looks fresh two weeks later."},
      {"date": "2024-12-18", "rating": 4, "text": "Great work overall. Busy Saturday so wait was a bit longer than expected."}
    ],
    "topTownshipReviews": [
      {"salonName": "Glam House Nails", "date": "2025-04-02", "rating": 5, "text": "Best pedicure I have had locally; attention to cuticle detail was excellent."},
      {"salonName": "StarGirl Studios", "date": "2025-03-20", "rating": 5, "text": "Loved the nail art options and the technician explained aftercare clearly."},
      {"salonName": "Angel Tips Nail Spa", "date": "2025-03-11", "rating": 5, "text": "Friendly front desk and very thorough prep before polish."},
      {"salonName": "Rachel Nail Art", "date": "2025-02-28", "rating": 5, "text": "Korean gel style came out exactly like the reference photo."},
      {"salonName": "Marcela Catano Nails", "date": "2025-02-14", "rating": 4, "text": "Solid service; would return for fills."}
    ],
    "whyGood": [
      "Strong Google rating vs local peers with healthy review volume.",
      "Clients repeatedly mention consistency, cleanliness, and technician patience."
    ],
    "toImprove": [
      "Peak-hour wait times show up in reviews; consider staggered booking or text-ahead check-in.",
      "A few comments ask for clearer pricing on add-ons; tightening menu communication can lift conversion."
    ]
  }'::jsonb
where slug = 'angel-tips-garwood';

insert into public.stores (
  slug,
  name_zh,
  name_en,
  google_review_url,
  google_review_fallback_url,
  review_keywords,
  is_active,
  address,
  city,
  township,
  google_rating,
  google_review_count,
  marketing_score,
  intel_listed,
  intel_report
) values
(
  'glam-house-garwood',
  'Glam House Nails',
  'Glam House Nails',
  'https://maps.app.goo.gl/example-glam-house',
  'https://maps.app.goo.gl/example-glam-house',
  '[]'::jsonb,
  false,
  '212 South Ave, Garwood, NJ 07027, USA',
  'Garwood',
  'Garwood Borough, NJ',
  4.9,
  188,
  84.2,
  true,
  '{
    "reviewSentiment": {"positivePct": 88, "neutralPct": 9, "negativePct": 3},
    "sentimentBenchmark": {"townshipPositivePct": 79, "note": "Above township sentiment mix; lean into photo-forward social proof."},
    "salonReviews": [
      {"date": "2025-03-28", "rating": 5, "text": "Nail art came out crisp and lasted through a vacation week."}
    ],
    "topTownshipReviews": [],
    "whyGood": ["Elite rating with focused specialty positioning."],
    "toImprove": ["Review count is lower than top peers; capture more post-visit requests."]
  }'::jsonb
),
(
  'stargirl-studios-garwood',
  'StarGirl Studios',
  'StarGirl Studios',
  'https://maps.app.goo.gl/example-stargirl',
  'https://maps.app.goo.gl/example-stargirl',
  '[]'::jsonb,
  false,
  '450 North Ave, Garwood, NJ 07027, USA',
  'Garwood',
  'Garwood Borough, NJ',
  5.0,
  96,
  81.0,
  true,
  '{
    "reviewSentiment": {"positivePct": 91, "neutralPct": 7, "negativePct": 2},
    "sentimentBenchmark": {"townshipPositivePct": 79, "note": "Very positive tone; maintain authenticity in responses."},
    "salonReviews": [
      {"date": "2025-03-05", "rating": 5, "text": "Studio vibe is welcoming and the sets look very polished."}
    ],
    "topTownshipReviews": [],
    "whyGood": ["Perfect rating anchor for premium positioning."],
    "toImprove": ["Smaller review base; diversify acquisition beyond walk-ins."]
  }'::jsonb
),
(
  'rachel-nail-art-garwood',
  'Rachel Nail Art / Korean Nail Art',
  'Rachel Nail Art / Korean Nail Art',
  'https://maps.app.goo.gl/example-rachel',
  'https://maps.app.goo.gl/example-rachel',
  '[]'::jsonb,
  false,
  '120 North Ave, Garwood, NJ 07027, USA',
  'Garwood',
  'Garwood Borough, NJ',
  4.9,
  412,
  88.4,
  true,
  '{
    "reviewSentiment": {"positivePct": 86, "neutralPct": 11, "negativePct": 3},
    "sentimentBenchmark": {"townshipPositivePct": 79, "note": "High engagement niche; benchmark against top-decile marketing scores."},
    "salonReviews": [
      {"date": "2025-04-01", "rating": 5, "text": "Reference designs matched closely and chips were rare."}
    ],
    "topTownshipReviews": [],
    "whyGood": ["Largest review footprint in the township sample with elite rating."],
    "toImprove": ["Operational load at volume; protect appointment buffer for VIP clients."]
  }'::jsonb
),
(
  'marcela-catano-garwood',
  'Marcela Catano Nails',
  'Marcela Catano Nails',
  'https://maps.app.goo.gl/example-marcela',
  'https://maps.app.goo.gl/example-marcela',
  '[]'::jsonb,
  false,
  '180 Center St, Garwood, NJ 07027, USA',
  'Garwood',
  'Garwood Borough, NJ',
  4.9,
  203,
  83.1,
  true,
  '{
    "reviewSentiment": {"positivePct": 87, "neutralPct": 10, "negativePct": 3},
    "sentimentBenchmark": {"townshipPositivePct": 79, "note": "Strong performer; keep highlighting detailed nail art portfolio."},
    "salonReviews": [
      {"date": "2025-03-18", "rating": 5, "text": "Shaping was precise and the finish stayed glossy for weeks."}
    ],
    "topTownshipReviews": [],
    "whyGood": ["High rating with dependable turnaround on appointments."],
    "toImprove": ["Add more recent Google posts to match leaders on marketing score."]
  }'::jsonb
),
(
  'horizon-nail-edgewater',
  'Horizon Nail and Spa',
  'Horizon Nail and Spa',
  'https://maps.app.goo.gl/example-horizon',
  'https://maps.app.goo.gl/example-horizon',
  '[]'::jsonb,
  false,
  '505 River Rd, Edgewater, NJ 07020, USA',
  'Edgewater',
  'Edgewater Borough, NJ',
  4.2,
  240,
  62.0,
  true,
  '{
    "reviewSentiment": {"positivePct": 68, "neutralPct": 22, "negativePct": 10},
    "sentimentBenchmark": {"townshipPositivePct": 74, "note": "Local tone skews slightly more critical; prioritize response time on Google."},
    "salonReviews": [
      {"date": "2025-01-10", "rating": 4, "text": "Good value manicure; room was a bit noisy during rush hour."}
    ],
    "topTownshipReviews": [
      {"salonName": "River Road Nails", "date": "2025-03-15", "rating": 5, "text": "Walk-in friendly and quick polish change."}
    ],
    "whyGood": ["Convenient River Road location with steady foot traffic."],
    "toImprove": ["Rating trails Edgewater median; tighten service consistency and follow-up on 3–4 star reviews."]
  }'::jsonb
)
on conflict (slug) do update
set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  google_review_url = excluded.google_review_url,
  google_review_fallback_url = excluded.google_review_fallback_url,
  review_keywords = excluded.review_keywords,
  address = excluded.address,
  city = excluded.city,
  township = excluded.township,
  google_rating = excluded.google_rating,
  google_review_count = excluded.google_review_count,
  marketing_score = excluded.marketing_score,
  intel_listed = excluded.intel_listed,
  intel_report = excluded.intel_report,
  updated_at = now();
