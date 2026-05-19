-- Private guest feedback left from /stores/:slug (not posted to Google).
-- Run in Supabase SQL Editor after base schema (stores table exists).
-- Inserts use SUPABASE_SERVICE_ROLE_KEY from Vercel; RLS allows service_role only.

create table if not exists public.store_private_feedback (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  phone text,
  google_account text,
  body text not null,
  lang text,
  user_agent text,
  client_ip text,
  created_at timestamptz not null default now()
);

create index if not exists store_private_feedback_store_created_idx
  on public.store_private_feedback (store_id, created_at desc);

comment on table public.store_private_feedback is 'Salon guests submit private feedback from the public store page.';
comment on column public.store_private_feedback.google_account is 'Optional Gmail / Google account email the guest uses for Maps.';
comment on column public.store_private_feedback.phone is 'Optional phone for follow-up (store handles consent off-app).';

alter table public.store_private_feedback enable row level security;

drop policy if exists store_private_feedback_service_role_all on public.store_private_feedback;

create policy store_private_feedback_service_role_all
  on public.store_private_feedback
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.store_private_feedback to service_role;
