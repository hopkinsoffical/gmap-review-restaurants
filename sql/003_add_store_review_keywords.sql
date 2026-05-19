alter table public.stores
add column if not exists review_keywords jsonb not null default '[]'::jsonb;

update public.stores
set review_keywords = '[
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
]'::jsonb
where slug = 'angel-tips-garwood'
  and coalesce(jsonb_array_length(review_keywords), 0) = 0;
