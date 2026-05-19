create extension if not exists citext;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  username citext not null unique,
  global_role text not null default 'user',
  status text not null default 'active',
  shopify_customer_gid text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_global_role_chk check (global_role in ('admin', 'user')),
  constraint user_profiles_status_chk check (status in ('active', 'disabled'))
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  membership_role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_memberships_role_chk check (membership_role in ('owner', 'member'))
);

create unique index if not exists store_memberships_store_user_uidx
on public.store_memberships (store_id, user_id);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_store_memberships_updated_at on public.store_memberships;
create trigger trg_store_memberships_updated_at
before update on public.store_memberships
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.store_memberships enable row level security;
