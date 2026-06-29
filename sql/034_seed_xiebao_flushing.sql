-- Seed the Xiebao Flushing (蟹宝 Flushing) store into the RESTAURANT system.
--
-- Original location: New York Food Court, 133-35 Roosevelt Ave Unit 26, Flushing NY 11354.
-- slug 'xiebao-flushing' matches the public /stores/xiebao-flushing route.
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
  'xiebao-flushing',
  '蟹宝 Flushing',
  'Xiebao Flushing',
  'https://www.google.com/maps?q=Xie+Bao+Flushing+蟹寶,+133-35+Roosevelt+Ave,+Flushing,+NY+11354,+United+States&ftid=0x89c2610055f6dbc3:0x6f7c13f2a720ac16&entry=gps&shh=CAE&lucs=,94297699,94231188,94280568,47071704,94218641,94282134,94286869&g_ep=CAISEjI2LjA1LjEuODYxMzIyMjEwMBgAIIgnKj8sOTQyOTc2OTksOTQyMzExODgsOTQyODA1NjgsNDcwNzE3MDQsOTQyMTg2NDEsOTQyODIxMzQsOTQyODY4NjlCAlBI&skid=19384469-7683-4874-80fa-012dbb8411dd&g_st=ic',
  'https://www.google.com/maps?q=Xie+Bao+Flushing+蟹寶,+133-35+Roosevelt+Ave,+Flushing,+NY+11354,+United+States&ftid=0x89c2610055f6dbc3:0x6f7c13f2a720ac16&entry=gps&shh=CAE&lucs=,94297699,94231188,94280568,47071704,94218641,94282134,94286869&g_ep=CAISEjI2LjA1LjEuODYxMzIyMjEwMBgAIIgnKj8sOTQyOTc2OTksOTQyMzExODgsOTQyODA1NjgsNDcwNzE3MDQsOTQyMTg2NDEsOTQyODIxMzQsOTQyODY4NjlCAlBI&skid=19384469-7683-4874-80fa-012dbb8411dd&g_st=ic',
  '0x89c2610055f6dbc3:0x6f7c13f2a720ac16',
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

-- NEXT (dish vocabulary): publish a store_menu_snapshots row for this store with
-- xiebao's real menu (Chinese seafood / crab), else dish-based review parts fall
-- back to the salon menu.json. Easiest: have the store upload its menu through
-- the normal menu/receipt flow (recognize.js), which creates the snapshot.
