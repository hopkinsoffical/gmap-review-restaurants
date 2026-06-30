-- Seed the Xiebao Manhattan (蟹宝 Manhattan) store into the RESTAURANT system.
--
-- slug 'xiebao-manhattan' matches the public /stores/xiebao-manhattan route.
-- Google place: Xie Bao 蟹宝 — 0x89c25900533f308d:0x955c81afe0a5c325
-- Run in the RESTAURANT Supabase SQL Editor. Idempotent.

insert into public.stores (
  slug,
  name_zh,
  name_en,
  google_review_url,
  google_review_fallback_url,
  google_place_id,
  review_keywords,
  is_active
) values (
  'xiebao-manhattan',
  '蟹宝 Manhattan',
  'Xiebao Manhattan',
  'https://www.google.com/maps/place/Xie+Bao+%E8%9F%B9%E5%AE%9D/@40.7606451,-73.9933645,747m/data=!3m1!1e3!4m8!3m7!1s0x89c25900533f308d:0x955c81afe0a5c325!8m2!3d40.7606411!4d-73.9907896!9m1!1b1!16s%2Fg%2F11wy40txdp?entry=ttu&g_ep=EgoyMDI2MDYyOC4wIKXMDSoASAFQAw%3D%3D',
  'https://www.google.com/maps/place/Xie+Bao+%E8%9F%B9%E5%AE%9D/@40.7606451,-73.9933645,747m/data=!3m1!1e3!4m8!3m7!1s0x89c25900533f308d:0x955c81afe0a5c325!8m2!3d40.7606411!4d-73.9907896!9m1!1b1!16s%2Fg%2F11wy40txdp?entry=ttu&g_ep=EgoyMDI2MDYyOC4wIKXMDSoASAFQAw%3D%3D',
  '0x89c25900533f308d:0x955c81afe0a5c325',
  '[
    {"key":"fresh","text_zh":"新鲜","text_en":"fresh","enabled":true,"weight":1},
    {"key":"flavorful","text_zh":"入味","text_en":"flavorful","enabled":true,"weight":0.95},
    {"key":"authentic","text_zh":"地道","text_en":"authentic","enabled":true,"weight":0.9},
    {"key":"generous","text_zh":"份量足","text_en":"generous portions","enabled":true,"weight":0.85},
    {"key":"savory","text_zh":"鲜美","text_en":"savory","enabled":true,"weight":0.8},
    {"key":"attentive","text_zh":"服务热情","text_en":"attentive service","enabled":true,"weight":0.75},
    {"key":"clean","text_zh":"环境干净","text_en":"clean","enabled":true,"weight":0.7},
    {"key":"fast","text_zh":"上菜快","text_en":"quick service","enabled":true,"weight":0.65},
    {"key":"value","text_zh":"性价比高","text_en":"great value","enabled":true,"weight":0.6},
    {"key":"signature_crab","text_zh":"招牌蟹","text_en":"signature crab","enabled":true,"weight":0.55}
  ]'::jsonb,
  true
)
on conflict (slug) do update
set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  google_review_url = excluded.google_review_url,
  google_review_fallback_url = excluded.google_review_fallback_url,
  google_place_id = excluded.google_place_id,
  review_keywords = excluded.review_keywords,
  is_active = excluded.is_active,
  updated_at = now();
