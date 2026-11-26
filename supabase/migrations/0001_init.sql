-- Gordon Digital Approvals: initial schema
-- Run in the Supabase SQL editor, or with `supabase db push`.

-- Who counts as Gordon Digital team. Rows are either a full email or a domain starting with @.
create table if not exists public.team_access (
  pattern text primary key
);
insert into public.team_access (pattern) values ('@gordondigital.com.au') on conflict do nothing;

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_access t
    where lower(auth.jwt() ->> 'email') = lower(t.pattern)
       or (t.pattern like '@%' and lower(auth.jwt() ->> 'email') like '%' || lower(t.pattern))
  );
$$;

-- Clients. `data` holds the same shape the portal uses: name, website, platforms,
-- folders per approval type, archived months, brand assets, approver details.
create table if not exists public.clients (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Every reviewable thing: Meta ads, search ads, pages, content, social posts.
create table if not exists public.items (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  kind text generated always as (coalesce(data ->> 'kind', 'meta')) stored,
  status text generated always as (data ->> 'status') stored,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists items_client_idx on public.items(client_id);
create index if not exists items_status_idx on public.items(status);

-- Shared settings, e.g. id 'team' holds the strategist list and their details.
create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Private review links. One or more per client, revocable.
create table if not exists public.review_links (
  token text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  created_by text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists review_links_client_idx on public.review_links(client_id);

-- Six digit codes approvers enter the first time they approve on a device.
create table if not exists public.approval_codes (
  id bigint generated always as identity primary key,
  client_id text not null references public.clients(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

-- Audit trail: who did what and when. Written by the server only.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  client_id text,
  item_id text,
  type text not null,
  actor_name text,
  actor_email text,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists events_client_idx on public.events(client_id, at desc);

-- Reminder emails sent, so each item is chased once per overdue step.
create table if not exists public.reminders (
  item_id text not null,
  sent_for timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, sent_for)
);

-- Keep updated_at current
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- Row level security: the team can do everything; nobody else can touch tables directly.
-- Clients never query the database. Review links go through server routes that use the
-- service role and only ever return that one client's work.
alter table public.team_access enable row level security;
alter table public.clients enable row level security;
alter table public.items enable row level security;
alter table public.settings enable row level security;
alter table public.review_links enable row level security;
alter table public.approval_codes enable row level security;
alter table public.events enable row level security;
alter table public.reminders enable row level security;

drop policy if exists team_all_clients on public.clients;
create policy team_all_clients on public.clients for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists team_all_items on public.items;
create policy team_all_items on public.items for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists team_all_settings on public.settings;
create policy team_all_settings on public.settings for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists team_read_links on public.review_links;
create policy team_read_links on public.review_links for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists team_read_events on public.events;
create policy team_read_events on public.events for select to authenticated using (public.is_team());
drop policy if exists team_read_access on public.team_access;
create policy team_read_access on public.team_access for select to authenticated using (public.is_team());

-- API access. Works whether or not "Grant API access to new tables automatically" was ticked.
-- Signed in users (the team, limited by the policies above) and the server get access. Anonymous visitors get none.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
grant execute on function public.is_team() to authenticated, service_role;

-- Live updates for the team portal
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.clients'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.items'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.settings'; exception when others then null; end;
end $$;

-- Private bucket for creative, designs, logos and brand files (200 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 209715200)
on conflict (id) do update set public = false, file_size_limit = 209715200;

drop policy if exists team_media_all on storage.objects;
create policy team_media_all on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_team())
  with check (bucket_id = 'media' and public.is_team());
