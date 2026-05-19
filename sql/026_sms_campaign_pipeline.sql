-- Twilio bulk SMS campaign pipeline (RankMySalon).
-- Run in Supabase SQL Editor after base schema and optional contact_leads (012, 025).
-- Server access via SUPABASE_SERVICE_ROLE_KEY; RLS allows service_role only.

create table if not exists public.sms_leads (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  name text,
  email text,
  source text not null default 'import',
  external_id text,
  opt_out boolean not null default false,
  opt_out_reason text,
  opt_out_at timestamptz,
  last_reply_at timestamptz,
  last_reply_body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_leads_phone_e164_uidx unique (phone_e164)
);

create index if not exists sms_leads_opt_out_idx
  on public.sms_leads (opt_out, created_at desc);

create index if not exists sms_leads_external_id_idx
  on public.sms_leads (external_id)
  where external_id is not null;

drop trigger if exists sms_leads_set_updated_at on public.sms_leads;
create trigger sms_leads_set_updated_at
  before update on public.sms_leads
  for each row execute function public.set_updated_at();

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body_template text not null,
  status text not null default 'draft',
  daily_send_limit integer not null default 500
    constraint sms_campaigns_daily_send_limit_positive_chk check (daily_send_limit > 0),
  messaging_service_sid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_campaigns_status_chk
    check (status in ('draft', 'active', 'paused', 'completed'))
);

create index if not exists sms_campaigns_status_idx
  on public.sms_campaigns (status, created_at desc);

drop trigger if exists sms_campaigns_set_updated_at on public.sms_campaigns;
create trigger sms_campaigns_set_updated_at
  before update on public.sms_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sms_campaigns(id) on delete cascade,
  lead_id uuid not null references public.sms_leads(id) on delete cascade,
  to_phone_e164 text not null,
  body text not null,
  status text not null default 'queued',
  twilio_sid text,
  twilio_error_code text,
  twilio_error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  replied_at timestamptz,
  reply_snippet text,
  last_twilio_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_messages_status_chk
    check (status in (
      'queued',
      'sending',
      'sent',
      'delivered',
      'failed',
      'undelivered',
      'cancelled'
    )),
  constraint sms_messages_campaign_lead_uidx unique (campaign_id, lead_id),
  constraint sms_messages_twilio_sid_uidx unique (twilio_sid)
);

create index if not exists sms_messages_campaign_status_idx
  on public.sms_messages (campaign_id, status, created_at);

create index if not exists sms_messages_queued_idx
  on public.sms_messages (status, created_at)
  where status = 'queued';

drop trigger if exists sms_messages_set_updated_at on public.sms_messages;
create trigger sms_messages_set_updated_at
  before update on public.sms_messages
  for each row execute function public.set_updated_at();

alter table public.sms_leads enable row level security;
alter table public.sms_campaigns enable row level security;
alter table public.sms_messages enable row level security;

drop policy if exists sms_leads_service_role_all on public.sms_leads;
create policy sms_leads_service_role_all
  on public.sms_leads
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists sms_campaigns_service_role_all on public.sms_campaigns;
create policy sms_campaigns_service_role_all
  on public.sms_campaigns
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists sms_messages_service_role_all on public.sms_messages;
create policy sms_messages_service_role_all
  on public.sms_messages
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.sms_leads to service_role;
grant all on table public.sms_campaigns to service_role;
grant all on table public.sms_messages to service_role;

comment on table public.sms_leads is
  'SMS marketing recipients; opt_out blocks sends (TCPA / user preference).';
comment on table public.sms_campaigns is
  'Outbound SMS campaign; body_template may include {{name}}.';
comment on table public.sms_messages is
  'Per-recipient message row; status updated via Twilio callbacks.';
