-- Example service catalog for the seed store (sql/002_seed_store_example.sql).
-- Run after public.store_service_items exists (sql/007_store_service_items.sql).

insert into public.store_service_items (
  store_id,
  dish_uqid,
  name,
  item_type,
  price,
  description,
  sort_order,
  is_active
)
select
  s.id,
  v.dish_uqid,
  v.name,
  v.item_type,
  v.price,
  '',
  v.sort_order,
  true
from public.stores s
cross join (
  values
    (1, 0, 'Gel Manicure', 'gel', 40.00::numeric),
    (2, 1, 'Gel French Manicure', 'gel', 55.00::numeric),
    (3, 2, 'Vita Gel Manicure', 'gel', 47.00::numeric),
    (4, 3, 'Deep Powder (Acrylic)', 'acrylic', 65.00::numeric),
    (5, 4, 'Deep Powder with Tip (Acrylic)', 'acrylic', 75.00::numeric),
    (6, 5, 'Deep Powder Tip with Gel Top (Acrylic)', 'acrylic', 85.00::numeric),
    (7, 6, 'UV Gel Set', 'uv_gel', 100.00::numeric),
    (8, 7, 'UV Gel with permanent French', 'uv_gel', 110.00::numeric),
    (9, 8, 'UV Gel with permanent French w/Tips', 'uv_gel', 120.00::numeric),
    (10, 9, 'UV Gel with permanent French w/Extension', 'uv_gel', 130.00::numeric),
    (11, 10, 'UV Gel Remove', 'removal', 20.00::numeric),
    (12, 11, 'Teen Tip Set', 'tip_set', 60.00::numeric),
    (13, 12, 'Prom Special Tip Set', 'tip_set', 60.00::numeric)
) as v(dish_uqid, sort_order, name, item_type, price)
where s.slug = 'angel-tips-garwood'
on conflict (store_id, dish_uqid) do update
set
  name = excluded.name,
  item_type = excluded.item_type,
  price = excluded.price,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
