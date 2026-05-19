-- SMS outreach funnel: Twilio link-click tracking + site beacon + nurture / sales stages.
-- Run in Supabase SQL Editor after prior migrations. Server writes via service_role only.
--
-- If you never ran sql/001_schema.sql, public.set_updated_at() may be missing and this file
-- would previously fail on the trigger — leaving no tables. The block below makes 027 safe
-- to run on a minimal Supabase project.

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

create table if not exists public.sms_outreach_session (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  to_e164 text not null,
  initial_message_sid text,
  funnel_stage text not null default 'sent',
  nurture_message_sid text,
  nurture_sent_at timestamptz,
  last_event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_outreach_session_slug_format_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint sms_outreach_session_funnel_stage_chk
    check (
      funnel_stage in (
        'sent',
        'link_click',
        'report_view',
        'nurture_sent',
        'engaged',
        'closed_won',
        'closed_lost'
      )
    )
);

create unique index if not exists sms_outreach_session_msg_sid_uidx
  on public.sms_outreach_session (initial_message_sid)
  where initial_message_sid is not null and btrim(initial_message_sid) <> '';

create index if not exists sms_outreach_session_slug_stage_idx
  on public.sms_outreach_session (slug, funnel_stage, updated_at desc);

create index if not exists sms_outreach_session_to_idx
  on public.sms_outreach_session (to_e164);

drop trigger if exists sms_outreach_session_set_updated_at on public.sms_outreach_session;
create trigger sms_outreach_session_set_updated_at
  before update on public.sms_outreach_session
  for each row execute function public.set_updated_at();

create table if not exists public.sms_outreach_event (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sms_outreach_session (id) on delete cascade,
  event_type text not null,
  source text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sms_outreach_event_session_created_idx
  on public.sms_outreach_event (session_id, created_at desc);

create index if not exists sms_outreach_event_type_idx
  on public.sms_outreach_event (event_type, created_at desc);

comment on table public.sms_outreach_session is
  'Outbound SMS funnel: stages sent → link_click (Twilio) → report_view (site) → nurture_sent (AI follow-up SMS).';

comment on table public.sms_outreach_event is
  'Append-only funnel events for monitoring / alerts (Twilio click, beacon, nurture, manual close).';

alter table public.sms_outreach_session enable row level security;
alter table public.sms_outreach_event enable row level security;

drop policy if exists sms_outreach_session_service_all on public.sms_outreach_session;
create policy sms_outreach_session_service_all
  on public.sms_outreach_session
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists sms_outreach_event_service_all on public.sms_outreach_event;
create policy sms_outreach_event_service_all
  on public.sms_outreach_event
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.sms_outreach_session to service_role;
grant all on table public.sms_outreach_event to service_role;
