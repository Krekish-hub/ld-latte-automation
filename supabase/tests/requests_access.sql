-- Supabase SQL Editor: replace ONLY the two UUIDs below with existing Auth users.
-- Run the entire file together as postgres. Every test row is rolled back.
begin;
select set_config('ld_latte.test_user_a', '11111111-1111-4111-8111-111111111111', true);
select set_config('ld_latte.test_user_b', '22222222-2222-4222-8222-222222222222', true);

do $$
begin
  if current_setting('ld_latte.test_user_a') = current_setting('ld_latte.test_user_b') then
    raise exception 'Use two different Auth users';
  end if;
  if (select count(*) from auth.users where id in (
    current_setting('ld_latte.test_user_a')::uuid,
    current_setting('ld_latte.test_user_b')::uuid
  )) <> 2 then
    raise exception 'Replace both placeholder UUIDs with real Auth user IDs first';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('ld_latte.test_user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ld_latte.test_user_a'), 'role', 'authenticated')::text, true);

insert into public.requests (id, title, description, category)
values ('e19e2503-c705-4c88-99be-938385308a01', '  RLS test A  ', '  Test description  ', 'bot');

do $$
declare r public.requests; n integer;
begin
  select * into strict r from public.requests where id = 'e19e2503-c705-4c88-99be-938385308a01';
  if r.user_id <> current_setting('ld_latte.test_user_a')::uuid
    or r.status <> 'new' or r.title <> 'RLS test A'
    or r.description <> 'Test description' then
    raise exception 'Owner/defaults/normalization failed';
  end if;
  begin
    insert into public.requests (id, title, description, category)
    values (r.id, 'Duplicate', 'Description', 'bot');
    raise exception 'Duplicate ID was accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', '   ', 'Description', 'bot');
    raise exception 'Blank title was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', 'Title', '   ', 'bot');
    raise exception 'Blank description was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', E' \t\n\r\f' || chr(11), 'Description', 'bot');
    raise exception 'Whitespace-only title was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', 'Title', E' \t\n\r\f' || chr(11), 'bot');
    raise exception 'Whitespace-only description was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', repeat('x', 161), 'Description', 'bot');
    raise exception 'Oversized title was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', 'Title', repeat('x', 10001), 'bot');
    raise exception 'Oversized description was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', 'Title', 'Description', 'invalid');
    raise exception 'Invalid category was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.requests (id, user_id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', current_setting('ld_latte.test_user_b')::uuid, 'Title', 'Description', 'bot');
    raise exception 'Explicit owner was accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.requests (id, title, description, category, status)
    values ('e19e2503-c705-4c88-99be-938385308a03', 'Title', 'Description', 'bot', 'completed');
    raise exception 'Explicit initial status was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.requests set user_id = current_setting('ld_latte.test_user_b')::uuid where id = r.id;
    raise exception 'Changing owner was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.requests set created_at = now() where id = r.id;
    raise exception 'Changing created_at was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.requests set updated_at = now() where id = r.id;
    raise exception 'Changing updated_at was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.requests set id = 'e19e2503-c705-4c88-99be-938385308a03' where id = r.id;
    raise exception 'Changing ID was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.requests set status = 'invalid' where id = r.id;
    raise exception 'Invalid status was accepted';
  exception when check_violation then null; end;
  update public.requests set title = 'Updated A', status = 'in_progress'
    where id = r.id returning * into r;
  get diagnostics n = row_count;
  if n <> 1 or r.title is distinct from 'Updated A'
    or r.status is distinct from 'in_progress'
    or r.updated_at is null or r.updated_at < r.created_at then
    raise exception 'Own update failed';
  end if;
  begin
    delete from public.requests where id = r.id;
    raise exception 'DELETE was allowed';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('ld_latte.test_user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ld_latte.test_user_b'), 'role', 'authenticated')::text, true);

do $$
declare n integer;
begin
  if exists (select 1 from public.requests where id = 'e19e2503-c705-4c88-99be-938385308a01') then
    raise exception 'B can read A';
  end if;
  update public.requests set title = 'Hacked' where id = 'e19e2503-c705-4c88-99be-938385308a01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B can update A'; end if;
end;
$$;

insert into public.requests (id, title, description, category)
values ('e19e2503-c705-4c88-99be-938385308a02', 'RLS test B', 'Test description', 'report');

do $$
begin
  if not exists (select 1 from public.requests where id = 'e19e2503-c705-4c88-99be-938385308a02') then
    raise exception 'B cannot read own row';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('ld_latte.test_user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ld_latte.test_user_a'), 'role', 'authenticated')::text, true);
do $$
declare n integer;
begin
  if exists (select 1 from public.requests where id = 'e19e2503-c705-4c88-99be-938385308a02') then
    raise exception 'A can read B';
  end if;
  if not exists (select 1 from public.requests where id = 'e19e2503-c705-4c88-99be-938385308a01' and title = 'Updated A') then
    raise exception 'A cannot read own unchanged-by-B row';
  end if;
  update public.requests set title = 'Hacked by A' where id = 'e19e2503-c705-4c88-99be-938385308a02';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A can update B'; end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.requests limit 1;
    raise exception 'Anon SELECT was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.requests (id, title, description, category)
    values ('e19e2503-c705-4c88-99be-938385308a03', 'Anon', 'Description', 'bot');
    raise exception 'Anon INSERT was allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.requests set title = 'Anon';
    raise exception 'Anon UPDATE was allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.requests;
    raise exception 'Anon DELETE was allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'PASS: constraints, column grants, A/B isolation and anon access; test data rolled back' as result;
