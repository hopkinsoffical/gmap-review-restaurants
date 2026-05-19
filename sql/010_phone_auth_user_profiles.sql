-- Phone-based auth: store E.164 phone on profiles for admin portal display and uniqueness.
-- Run after 005_auth_profiles_and_memberships.sql. Safe to re-run.

alter table public.user_profiles
  add column if not exists phone citext;

create unique index if not exists user_profiles_phone_uidx
  on public.user_profiles (phone)
  where phone is not null;
