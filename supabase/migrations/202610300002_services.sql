-- Run once as postgres in Supabase SQL Editor. Does not depend on requests.
begin;

-- Password remains unset: set it separately in a private administrative session.
-- Intentionally fail if this role/table already exists; do not take over a role.
create role n8n_services_reader login
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  connection limit 3;

do $$
begin
  execute format('grant connect on database %I to n8n_services_reader', current_database());
end;
$$;

grant usage on schema public to n8n_services_reader;

create table public.services (
  id uuid primary key,
  name text not null constraint services_name_valid check (
    char_length(name) <= 160
    and char_length(btrim(name, E' \t\n\r\f' || chr(11))) > 0
  ),
  active boolean not null default true,
  sort_order integer not null default 0
);

alter table public.services enable row level security;

-- Narrow Supabase's possible default grants for this new table only.
revoke all privileges on table public.services
  from public, anon, authenticated, n8n_services_reader;
grant select on table public.services to n8n_services_reader;

create policy services_reader_active on public.services
for select to n8n_services_reader
using (active = true);

create index services_active_order_idx
  on public.services (sort_order, id) where active = true;

comment on table public.services is
  'Fictional Telegram menu services. n8n_services_reader can SELECT active rows only.';

-- The fresh role receives no grants on auth or requests. Detect unsafe pre-existing
-- PUBLIC grants without changing another component's privileges/defaults.
do $$
begin
  if to_regclass('auth.users') is not null
    and has_table_privilege('n8n_services_reader', 'auth.users', 'SELECT') then
    raise exception 'Unsafe existing PUBLIC access to auth.users; inspect grants before proceeding';
  end if;
  if to_regclass('public.requests') is not null then
    if has_table_privilege('n8n_services_reader', 'public.requests', 'SELECT')
      or has_table_privilege('n8n_services_reader', 'public.requests', 'INSERT')
      or has_table_privilege('n8n_services_reader', 'public.requests', 'UPDATE')
      or has_table_privilege('n8n_services_reader', 'public.requests', 'DELETE') then
      raise exception 'Unsafe existing PUBLIC access to requests; inspect grants before proceeding';
    end if;
  end if;
end;
$$;

commit;
