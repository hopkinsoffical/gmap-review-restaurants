-- NJ salons verified as mobile (SMS-capable) phone lines only.
-- Populated by scripts/sync_salon_nj_mobile_phones.py (Twilio Line Type Intelligence).
-- Run in Supabase SQL Editor after sql/021_leaderboard_slug_history_latest_view.sql.

create table if not exists public.salon_nj_mobile_phones (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  mobile text not null,
  phone text not null default '',
  name text not null,
  -- User-facing "current_date": date of last sync / snapshot (not a PostgreSQL keyword).
  snapshot_date date not null default (CURRENT_DATE),
  address text not null default '',
  zipcode text not null default '',
  state text not null default 'NJ',
  twilio_line_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_nj_mobile_phones_slug_key unique (slug),
  constraint salon_nj_mobile_phones_slug_format_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint salon_nj_mobile_phones_state_nj_chk
    check (btrim(state) ~* '^nj$|^new jersey$')
);

comment on table public.salon_nj_mobile_phones is
  'NJ leaderboard salons whose phone is Twilio-verified mobile/wireless (SMS-capable).';

comment on column public.salon_nj_mobile_phones.snapshot_date is
  'Export/sync run date (maps to requested current_date field).';

comment on column public.salon_nj_mobile_phones.mobile is
  'E.164 mobile number (same as leaderboard phone when line type is mobile/wireless).';

create index if not exists salon_nj_mobile_phones_state_snapshot_idx
  on public.salon_nj_mobile_phones (state, snapshot_date desc);

create index if not exists salon_nj_mobile_phones_mobile_idx
  on public.salon_nj_mobile_phones (mobile);

drop trigger if exists salon_nj_mobile_phones_set_updated_at on public.salon_nj_mobile_phones;
create trigger salon_nj_mobile_phones_set_updated_at
  before update on public.salon_nj_mobile_phones
  for each row execute function public.set_updated_at();

alter table public.salon_nj_mobile_phones enable row level security;

drop policy if exists salon_nj_mobile_phones_service_role_all on public.salon_nj_mobile_phones;
create policy salon_nj_mobile_phones_service_role_all
  on public.salon_nj_mobile_phones
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.salon_nj_mobile_phones to service_role;
