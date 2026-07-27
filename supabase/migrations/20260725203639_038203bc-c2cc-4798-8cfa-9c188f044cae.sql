
create table public.nav_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_user_org_id(),
  user_id uuid not null default auth.uid(),
  source text not null check (source in ('sidebar', 'buscador')),
  item_url text not null,
  item_title text not null,
  section_label text,
  role text,
  created_at timestamptz not null default now()
);

grant insert on public.nav_events to authenticated;
grant select on public.nav_events to authenticated;
grant all on public.nav_events to service_role;

alter table public.nav_events enable row level security;

drop policy if exists "nav_events insert own org" on public.nav_events;
create policy "nav_events insert own org"
  on public.nav_events
  for insert
  to authenticated
  with check (organization_id = current_user_org_id() and user_id = auth.uid());

drop policy if exists "nav_events read admin" on public.nav_events;
create policy "nav_events read admin"
  on public.nav_events
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'super_admin'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'admin_org'::app_role)
  );

create index if not exists idx_nav_events_org_fecha on public.nav_events (organization_id, created_at desc);
