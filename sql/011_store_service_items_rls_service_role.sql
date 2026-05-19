-- If store_service_items has RLS enabled but no policies, PostgREST may reject DML
-- when the request does not bypass RLS as expected. This policy allows the
-- Supabase service_role (used by the server with SUPABASE_SERVICE_ROLE_KEY) full access.
--
-- Run in Supabase SQL Editor after sql/007_store_service_items.sql (or 001_schema.sql).
-- Idempotent: drop + recreate policy.

drop policy if exists store_service_items_service_role_all on public.store_service_items;

create policy store_service_items_service_role_all
  on public.store_service_items
  for all
  to service_role
  using (true)
  with check (true);
