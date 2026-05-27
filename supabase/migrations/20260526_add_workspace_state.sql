-- Global workspace state for Servimeci
-- Stores shared saves and the global drawing scene in Supabase.

create table if not exists public.flow_servimeci_workspace_state (
  id text primary key,
  saves jsonb not null default '[]'::jsonb,
  drawing_scene jsonb,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.flow_servimeci_workspace_state to anon, authenticated, service_role;
