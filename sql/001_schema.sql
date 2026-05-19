-- RankMySalon base schema (Supabase / Postgres).
-- Run this whole file FIRST on an empty project so public.stores and related tables exist.
-- Later: optional seeds (002, …), auth (005), audit (006); incremental 007 only if you skipped an older 001.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_zh text not null,
  name_en text not null,
  google_review_url text not null,
  google_review_fallback_url text,
  google_place_id text,
  review_keywords jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_slug_format_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.store_menu_snapshots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  version integer not null,
  menu_json jsonb not null,
  source_type text not null default 'manual',
  source_note text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_menu_snapshots_version_positive_chk
    check (version > 0)
);

create unique index if not exists store_menu_snapshots_store_version_uidx
on public.store_menu_snapshots (store_id, version);

create unique index if not exists store_menu_snapshots_one_published_uidx
on public.store_menu_snapshots (store_id)
where is_published = true;

create index if not exists store_menu_snapshots_menu_json_gin_idx
on public.store_menu_snapshots
using gin (menu_json jsonb_path_ops);

create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  menu_snapshot_id uuid references public.store_menu_snapshots(id) on delete set null,
  image_kind text,
  recognition_mode text,
  recognized_dish_ids jsonb not null default '[]'::jsonb,
  success boolean not null default true,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists scan_events_store_id_created_at_idx
on public.scan_events (store_id, created_at desc);

create table if not exists public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  display_name text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_staff_store_name_uidx
on public.store_staff (store_id, name);

create index if not exists store_staff_store_sort_idx
on public.store_staff (store_id, sort_order asc, display_name asc);

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

drop trigger if exists trg_stores_updated_at on public.stores;
create trigger trg_stores_updated_at
before update on public.stores
for each row
execute function public.set_updated_at();

drop trigger if exists trg_store_menu_snapshots_updated_at on public.store_menu_snapshots;
create trigger trg_store_menu_snapshots_updated_at
before update on public.store_menu_snapshots
for each row
execute function public.set_updated_at();

drop trigger if exists trg_store_staff_updated_at on public.store_staff;
create trigger trg_store_staff_updated_at
before update on public.store_staff
for each row
execute function public.set_updated_at();

alter table public.stores enable row level security;
alter table public.store_menu_snapshots enable row level security;
alter table public.scan_events enable row level security;
alter table public.store_staff enable row level security;
alter table public.store_service_items enable row level security;
-- If server writes fail with RLS errors, run sql/011_store_service_items_rls_service_role.sql.

create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  company text,
  service text not null default '',
  message text not null,
  source text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint contact_leads_source_chk check (source in ('about_page', 'contact_modal'))
);

create index if not exists contact_leads_created_at_idx
on public.contact_leads (created_at desc);

alter table public.contact_leads enable row level security;

drop policy if exists contact_leads_service_role_all on public.contact_leads;

create policy contact_leads_service_role_all
  on public.contact_leads
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.contact_leads to service_role;
