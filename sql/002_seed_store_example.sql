insert into public.stores (
  slug,
  name_zh,
  name_en,
  google_review_url,
  google_review_fallback_url,
  review_keywords,
  is_active
) values (
  'angel-tips-garwood',
  'Angel Tips Nail Spa',
  'Angel Tips Nail Spa',
  'https://maps.app.goo.gl/QgrQK51pSCoWfy5v7',
  'https://maps.app.goo.gl/QgrQK51pSCoWfy5v7',
  '[
    {"key":"clean","text_zh":"干净","text_en":"clean","enabled":true,"weight":1},
    {"key":"detailed","text_zh":"细致","text_en":"detailed","enabled":true,"weight":0.9},
    {"key":"gentle","text_zh":"温柔","text_en":"gentle","enabled":true,"weight":0.8},
    {"key":"polished","text_zh":"精致","text_en":"polished","enabled":true,"weight":0.75},
    {"key":"relaxing","text_zh":"放松","text_en":"relaxing","enabled":true,"weight":0.72},
    {"key":"natural","text_zh":"自然","text_en":"natural","enabled":true,"weight":0.68},
    {"key":"glossy","text_zh":"亮泽","text_en":"glossy","enabled":true,"weight":0.66},
    {"key":"precise","text_zh":"精准","text_en":"precise","enabled":true,"weight":0.62},
    {"key":"lasting","text_zh":"持久","text_en":"long-lasting","enabled":true,"weight":0.58},
    {"key":"welcoming","text_zh":"热情","text_en":"welcoming","enabled":true,"weight":0.54}
  ]'::jsonb,
  true
)
on conflict (slug) do update
set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  google_review_url = excluded.google_review_url,
  google_review_fallback_url = excluded.google_review_fallback_url,
  review_keywords = excluded.review_keywords,
  is_active = excluded.is_active,
  updated_at = now();
