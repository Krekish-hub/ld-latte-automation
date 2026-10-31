-- Run as postgres. Restore exactly 0 active services in this nine-row demo set.
-- Other services are untouched; their active rows may also appear in the bot.
begin;
insert into public.services (id, name, active, sort_order)
values
  ('7d1a7700-0000-4000-8000-000000000001', 'Telegram-бот для заявок', false, 10),
  ('7d1a7700-0000-4000-8000-000000000002', 'Интеграция CRM', false, 20),
  ('7d1a7700-0000-4000-8000-000000000003', 'Автоматический отчёт', false, 30),
  ('7d1a7700-0000-4000-8000-000000000004', 'Уведомления о событиях', false, 40),
  ('7d1a7700-0000-4000-8000-000000000005', 'Синхронизация справочников', false, 50),
  ('7d1a7700-0000-4000-8000-000000000006', 'Сбор статистики', false, 60),
  ('7d1a7700-0000-4000-8000-000000000007', 'Обработка входящих писем', false, 70),
  ('7d1a7700-0000-4000-8000-000000000008', 'Напоминания о задачах', false, 80),
  ('7d1a7700-0000-4000-8000-000000000009', 'Автоматизация документов', false, 90)
on conflict (id) do update set
  name = excluded.name,
  active = excluded.active,
  sort_order = excluded.sort_order;
commit;
