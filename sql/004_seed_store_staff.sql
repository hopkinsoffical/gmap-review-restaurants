with target_store as (
  select id
  from public.stores
  where slug = 'angel-tips-garwood'
  limit 1
),
staff_seed(name, display_name, sort_order) as (
  values
    ('Tina', 'Tina', 1),
    ('Kavin', 'Kavin', 2),
    ('Mei', 'Mei', 3),
    ('Emma', 'Emma', 4),
    ('Lily', 'Lily', 5),
    ('Lin', 'Lin', 6),
    ('MK', 'MK', 7),
    ('Karla', 'Karla', 8),
    ('Roxy', 'Roxy', 9),
    ('Diana', 'Diana', 10),
    ('Evan', 'Evan', 11),
    ('Coco', 'Coco', 12),
    ('Luna', 'Luna', 13),
    ('Yeymmi', 'Yeymmi', 14),
    ('John', 'John', 15),
    ('Yoyo', 'Yoyo', 16),
    ('Betty', 'Betty', 17),
    ('Carmen', 'Carmen', 18),
    ('Maria', 'Maria', 19),
    ('Martha', 'Martha', 20),
    ('Maribel', 'Maribel', 21),
    ('Tiffany', 'Tiffany', 22),
    ('Fanny', 'Fanny', 23),
    ('Nancy', 'Nancy', 24),
    ('William', 'William', 25),
    ('Perte', 'Perte', 26),
    ('Lucy', 'Lucy', 27),
    ('Christina', 'Christina', 28)
)
insert into public.store_staff (store_id, name, display_name, sort_order, is_active)
select target_store.id, staff_seed.name, staff_seed.display_name, staff_seed.sort_order, true
from target_store
cross join staff_seed
on conflict (store_id, name) do update
set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
