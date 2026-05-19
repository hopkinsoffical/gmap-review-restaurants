-- Persist every inbound Twilio SMS webhook for audit, support, and inbox use.
-- Run after sql/026_sms_campaign_pipeline.sql in Supabase SQL Editor.

create table if not exists public.sms_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.sms_leads(id) on delete set null,
  sms_message_id uuid references public.sms_messages(id) on delete set null,
  from_phone_raw text not null default '',
  from_phone_e164 text,
  to_phone_raw text not null default '',
  to_phone_e164 text,
  body text not null default '',
  twilio_message_sid text,
  twilio_account_sid text,
  twilio_messaging_service_sid text,
  twilio_status text,
  keyword text,
  is_opt_out boolean not null default false,
  is_help boolean not null default false,
  is_confirm boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sms_inbound_messages_twilio_message_sid_uidx unique (twilio_message_sid)
);

create index if not exists sms_inbound_messages_lead_idx
  on public.sms_inbound_messages (lead_id, received_at desc)
  where lead_id is not null;

create index if not exists sms_inbound_messages_message_idx
  on public.sms_inbound_messages (sms_message_id, received_at desc)
  where sms_message_id is not null;

create index if not exists sms_inbound_messages_from_phone_idx
  on public.sms_inbound_messages (from_phone_e164, received_at desc)
  where from_phone_e164 is not null;

create index if not exists sms_inbound_messages_keyword_idx
  on public.sms_inbound_messages (keyword, received_at desc)
  where keyword is not null;

alter table public.sms_inbound_messages enable row level security;

drop policy if exists sms_inbound_messages_service_role_all on public.sms_inbound_messages;
create policy sms_inbound_messages_service_role_all
  on public.sms_inbound_messages
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.sms_inbound_messages to service_role;

comment on table public.sms_inbound_messages is
  'Immutable inbound SMS log from Twilio webhooks; one row per received message.';
comment on column public.sms_inbound_messages.payload is
  'Raw Twilio webhook form fields for auditing and debugging.';
