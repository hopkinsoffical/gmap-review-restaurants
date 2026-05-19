create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_user_created_idx
on public.audit_logs (actor_user_id, created_at desc);

create index if not exists audit_logs_entity_created_idx
on public.audit_logs (entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;
