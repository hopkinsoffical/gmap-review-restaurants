-- Seed the Xiebao Edison (蟹宝 Edison) store into the RESTAURANT system.
--
-- Why: xiebao was first set up on the rankmysalon platform, so the AI review
-- generator pulls SALON review_keywords + the salon fallback menu (menu.json /
-- lib/server/default-menu.js getDefaultSalonMenuJson) and emits nail-salon
-- vocabulary. Registering it here as a restaurant store with restaurant
-- review_keywords fixes the adjective vocabulary. (Dish vocabulary still needs a
-- published store_menu_snapshots row — see runbook note at bottom; until then the
-- generator falls back to the salon menu.json.)
--
-- slug MUST stay 'xiebao-edison' to match identity.accounts.slug in the vForce
-- RDS, which the loyalty ETL (sms-migration sql/009/010) joins on.
-- Run in the RESTAURANT Supabase SQL Editor. Idempotent.

insert into public.stores (
  slug,
  name_zh,
  name_en,
  google_review_url,
  google_review_fallback_url,
  review_keywords,
  is_active
) values (
  'xiebao-edison',
  '蟹宝 Edison',
  'Xiebao Edison',
  'https://www.google.com/maps/place/Xie+Bao/@40.5131462,-74.4085894,736m/data=!3m2!1e3!5s0x89c3c7df48f8a6a7:0x9199b8e50eabbc2a!4m8!3m7!1s0x89c3c7466ba52f2f:0xc487fc390524a986!8m2!3d40.5131462!4d-74.4060145!9m1!1b1!16s%2Fg%2F11vwz4qcrq?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D',
  'https://www.google.com/maps/place/Xie+Bao/@40.5131462,-74.4085894,736m/data=!3m2!1e3!5s0x89c3c7df48f8a6a7:0x9199b8e50eabbc2a!4m8!3m7!1s0x89c3c7466ba52f2f:0xc487fc390524a986!8m2!3d40.5131462!4d-74.4060145!9m1!1b1!16s%2Fg%2F11vwz4qcrq?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D',
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
  review_keywords = excluded.review_keywords,
  is_active = excluded.is_active,
  updated_at = now();

-- NEXT (dish vocabulary): publish a store_menu_snapshots row for this store with
-- xiebao's real menu (Chinese seafood / crab), else dish-based review parts fall
-- back to the salon menu.json. Easiest: have the store upload its menu through
-- the normal menu/receipt flow (recognize.js), which creates the snapshot.
