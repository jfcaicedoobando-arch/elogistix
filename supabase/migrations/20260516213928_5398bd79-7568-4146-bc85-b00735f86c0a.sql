
-- Tabla de logs estructurados del backend (B.1 / 8.171.0)
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  level text not null check (level in ('info','warn','error')),
  fn text not null,
  request_id uuid null,
  user_id uuid null,
  organization_id uuid null,
  msg text not null,
  payload jsonb null,
  latency_ms integer null,
  status_code integer null
);

create index if not exists idx_app_logs_org_ts on public.app_logs (organization_id, ts desc);
create index if not exists idx_app_logs_level_ts on public.app_logs (level, ts desc);
create index if not exists idx_app_logs_fn_ts on public.app_logs (fn, ts desc);
create index if not exists idx_app_logs_request on public.app_logs (request_id) where request_id is not null;

alter table public.app_logs enable row level security;

-- SELECT: super_admin todo, admin de la org sólo lo suyo
create policy "super_admin lee todos los logs"
  on public.app_logs for select
  to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role));

create policy "org admin lee logs de su org"
  on public.app_logs for select
  to authenticated
  using (
    organization_id is not null
    and is_org_admin(auth.uid(), organization_id)
  );

-- INSERT: cualquiera autenticado o servicio puede insertar (los edge functions usan service role)
create policy "insertar logs"
  on public.app_logs for insert
  to authenticated, anon
  with check (true);

-- No UPDATE ni DELETE desde la app (solo purge_app_logs_old via SECURITY DEFINER)

-- Función de purga (retención 30 días). El cron se programa con supabase--insert en otro paso.
create or replace function public.purge_app_logs_old()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.app_logs where ts < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_app_logs_old() from public;
grant execute on function public.purge_app_logs_old() to service_role;

comment on table public.app_logs is 'Logs estructurados de edge functions y procesos backend. Retención 30 días via purge_app_logs_old().';
