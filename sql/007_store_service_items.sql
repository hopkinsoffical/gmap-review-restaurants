-- Admin-editable service catalog rows; saving the portal form republishes store_menu_snapshots from this list.
-- PREREQUISITE: public.stores must already exist (FK store_id → stores.id).
-- If you get "relation public.stores does not exist", run the FULL sql/001_schema.sql first, then re-run this file if needed.
-- For brand-new installs, store_service_items is already included at the end of sql/001_schema.sql; you may skip this file.

create table if not exists public.store_service_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  dish_uqid integer not null,
  name text not null,
  item_type text not null default '',
  price numeric(12, 2) not null default 0,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_service_items_dish_uqid_positive_chk check (dish_uqid > 0),
  constraint store_service_items_unique_store_uqid unique (store_id, dish_uqid)
);

create index if not exists store_service_items_store_sort_idx
on public.store_service_items (store_id, sort_order asc, dish_uqid asc);

drop trigger if exists trg_store_service_items_updated_at on public.store_service_items;
create trigger trg_store_service_items_updated_at
before update on public.store_service_items
for each row
execute function public.set_updated_at();

alter table public.store_service_items enable row level security;

-- If writes from the server still fail with RLS/permission errors, run
-- sql/011_store_service_items_rls_service_role.sql (service_role policy).
