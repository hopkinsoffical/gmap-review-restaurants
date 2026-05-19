-- Add explicit SMS consent audit columns for contact_leads.
-- Run after sql/012_contact_leads.sql in Supabase SQL Editor.

alter table public.contact_leads
  add column if not exists sms_consent boolean not null default false;

alter table public.contact_leads
  add column if not exists sms_consent_at timestamptz;

alter table public.contact_leads
  add column if not exists sms_consent_ip text;

alter table public.contact_leads
  add column if not exists sms_consent_user_agent text;

create index if not exists contact_leads_sms_consent_idx
  on public.contact_leads (sms_consent, created_at desc);

comment on column public.contact_leads.sms_consent is
  'True when user explicitly checked SMS consent box at submit.';

comment on column public.contact_leads.sms_consent_at is
  'Server timestamp when SMS consent was captured.';

comment on column public.contact_leads.sms_consent_ip is
  'Best-effort client IP captured from forwarding headers.';

comment on column public.contact_leads.sms_consent_user_agent is
  'User-agent at the time SMS consent was captured.';
