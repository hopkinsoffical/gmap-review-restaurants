-- Loyalty clients captured by the AI review booster (public site, no auth).
-- New step after a customer posts a Google review: they leave a phone number to
-- get a promo code for their next visit. Server inserts with the service role.
--
-- visit_status ('new' | 'returning') is the new-vs-returning signal that feeds
-- the xiebao member-tier model's review-booster source: first capture of a phone
-- for a store = 'new', any later capture of the same phone = 'returning'.
-- An external ETL (sms-migration/scripts/sync_loyalty_clients.py) mirrors these
-- rows into the vForce RDS and maps store_slug -> identity.accounts -> org.
--
-- Ported from the rankmysalon site (its sql/037). Run in the restaurant
-- Supabase SQL Editor after sql/001_schema.sql. Idempotent.

create table if not exists public.loyalty_clients (
  id uuid primary key default gen_random_uuid(),
  store_slug text not null default '',
  place_id text,
  phone text not null,
  phone_digits text not null,                 -- normalized for dedupe
  promo_code text not null,
  visit_status text not null default 'new'
    constraint loyalty_clients_visit_status_chk check (visit_status in ('new', 'returning')),
  source text not null default 'review_booster',
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  sms_consent_ip text,
  sms_consent_user_agent text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one loyalty record per (store, phone); re-submits update it to 'returning'
  constraint loyalty_clients_store_phone_uq unique (store_slug, phone_digits)
);

create index if not exists loyalty_clients_created_at_idx
  on public.loyalty_clients (created_at desc);

alter table public.loyalty_clients enable row level security;

drop policy if exists loyalty_clients_service_role_all on public.loyalty_clients;
create policy loyalty_clients_service_role_all
  on public.loyalty_clients
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.loyalty_clients to service_role;
