-- Run selected examples separately as postgres, then /start in Telegram.
-- These examples touch only named demonstration UUIDs, never the entire table.

-- 1. Add an extra fictional service. Repeat safely without duplicating its ID.
insert into public.services (id, name, active, sort_order)
values ('7d1a7700-0000-4000-8000-000000000010', 'Новая тестовая интеграция', true, 100)
on conflict (id) do update set name = excluded.name, active = excluded.active, sort_order = excluded.sort_order;

-- 2. Rename: an old button still resolves the current name by stable ID.
update public.services set name = 'Telegram-бот: новое название'
where id = '7d1a7700-0000-4000-8000-000000000001';

-- 3. Disable: an old button should report that the service is unavailable.
update public.services set active = false
where id = '7d1a7700-0000-4000-8000-000000000001';

-- 4. Delete only the extra service from example 1 before replaying 0/2/5/9.
delete from public.services
where id = '7d1a7700-0000-4000-8000-000000000010';

-- Re-run a services-0/2/5/9.sql fixture to reset the original nine demo rows.
