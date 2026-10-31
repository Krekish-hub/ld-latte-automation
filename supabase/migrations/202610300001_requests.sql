-- Run once as postgres in Supabase SQL Editor. No application secrets required.
begin;

-- Dedicated non-exposed schema: do not add it to Data API exposed schemas.
create schema if not exists ld_latte_private;
revoke all on schema ld_latte_private from public, anon, authenticated;

create function ld_latte_private.prepare_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := pg_catalog.btrim(new.title, E' \t\n\r\f' || pg_catalog.chr(11));
  new.description := pg_catalog.btrim(new.description, E' \t\n\r\f' || pg_catalog.chr(11));
  if tg_op = 'UPDATE' then
    new.updated_at := pg_catalog.statement_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function ld_latte_private.prepare_request()
  from public, anon, authenticated;

create table public.requests (
  id uuid primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text not null
    constraint requests_title_length check (pg_catalog.char_length(title) between 1 and 160),
  description text not null
    constraint requests_description_length check (pg_catalog.char_length(description) between 1 and 10000),
  category text not null
    constraint requests_category_valid check (category in ('bot', 'integration', 'report', 'other')),
  status text not null default 'new'
    constraint requests_status_valid check (status in ('new', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Explicit even when the project's automatic enable-RLS event trigger is enabled.
alter table public.requests enable row level security;

create trigger requests_prepare_before_write
before insert or update on public.requests
for each row execute function ld_latte_private.prepare_request();

create index requests_owner_created_idx
  on public.requests (user_id, created_at desc, id desc);
create index requests_owner_status_created_idx
  on public.requests (user_id, status, created_at desc, id desc);

-- Supabase project defaults may grant broad table privileges: remove them first.
revoke all privileges on table public.requests from public, anon, authenticated;
grant select on table public.requests to authenticated;
grant insert (id, title, description, category)
  on table public.requests to authenticated;
grant update (title, description, category, status)
  on table public.requests to authenticated;

create policy requests_select_own on public.requests
for select to authenticated
using ((select auth.uid()) = user_id);

create policy requests_insert_own on public.requests
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy requests_update_own on public.requests
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

comment on table public.requests is
  'Automation requests. Browser clients can select/create/update only their own rows.';

commit;
