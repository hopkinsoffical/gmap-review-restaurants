-- Homepage hero "brief report" lead capture uses source hero_brief.
-- Run in Supabase SQL Editor after sql/012_contact_leads.sql.

alter table public.contact_leads drop constraint if exists contact_leads_source_chk;

alter table public.contact_leads add constraint contact_leads_source_chk
  check (source in ('about_page', 'contact_modal', 'hero_brief'));
