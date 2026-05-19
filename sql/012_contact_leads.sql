-- Marketing / Contact Us lead captures (public site, no auth).
-- Run in Supabase SQL Editor after base schema (sql/001_schema.sql).
-- Server inserts with SUPABASE_SERVICE_ROLE_KEY; RLS allows service_role only.
--
-- If the app still returns CONTACT_LEADS_* errors after this script:
--   1) Supabase → Project Settings → API → Reload schema cache
--   2) Confirm Vercel SUPABASE_SERVICE_ROLE_KEY is the service_role secret (not anon)
--   3) Re-run this file (idempotent) so the GRANT at the bottom is applied

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

-- Explicit table privileges (idempotent; helps if the role could not insert via PostgREST).
grant all on table public.contact_leads to service_role;
