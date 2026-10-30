# Настройка Supabase для заявок

Этот документ относится к веб-приложению. Telegram/services настраиваются отдельной миграцией и инструкцией. Все данные для демонстрации вымышленные.

## 1. Что требуется

- Доступ владельца к Dashboard уже созданного Supabase-проекта и его SQL Editor.
- Project URL и publishable key для frontend. Это публичная конфигурация; она не дает права выполнять миграции.
- Два различных тестовых пользователя Auth для проверки изоляции.

DB password, management token и service-role key для шагов через Dashboard не нужны. Не вставляйте секретный ключ в frontend, репозиторий или SQL-файлы.

## 2. Применить миграцию через SQL Editor

1. Откройте нужный проект в Supabase Dashboard. Проверьте Project URL, чтобы не изменить другой проект.
2. Откройте **SQL Editor**, создайте запрос; роль выполнения должна быть `postgres`.
3. Скопируйте **весь** файл [`202610300001_requests.sql`](../supabase/migrations/202610300001_requests.sql) и выполните одним запуском. Миграция содержит `BEGIN`/`COMMIT`: таблица, триггер, grants и политики создаются вместе.
4. Убедитесь, что запрос завершился успешно. Если он упал, выполните `ROLLBACK;` перед новым запуском в той же сессии и исправьте причину. Не удаляйте существующую таблицу с данными ради повторного запуска.
5. Миграция предназначена для однократного применения к проекту без `public.requests`. Повторное применение специально завершается ошибкой, а не подменяет существующую схему. Выполнение через SQL Editor не добавляет запись в журнал Supabase CLI migrations: если позже вводится CLI, сначала согласуйте migration history.

Автоматический event trigger Supabase, включающий RLS на новых таблицах, отключать не нужно. Явный `ENABLE ROW LEVEL SECURITY` совместим с уже включенным RLS. Мы не меняем глобальные default privileges или event triggers. Служебная trigger function находится в `ld_latte_private`, использует пустой `search_path`, не имеет `SECURITY DEFINER` и не должна добавляться в список exposed schemas API. Таблица находится в стандартном `public`.

## 3. Проверить итоговую схему

Выполните как `postgres`:

```sql
select c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'requests';

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'requests';

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'requests'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by grantee, privilege_type;

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'requests'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by grantee, privilege_type, column_name;
```

Ожидается `rls_enabled = true`, три политики SELECT/INSERT/UPDATE для `authenticated`; на уровне всей таблицы у этой роли только SELECT. На уровне колонок INSERT разрешен только для `id`, `title`, `description`, `category`, UPDATE только для `title`, `description`, `category`, `status`. В `column_privileges` также могут отображаться SELECT-права всех колонок вследствие табличного SELECT. У `anon`/`PUBLIC` прав на таблицу быть не должно. Наличие административных прав у владельца/service_role не является ошибкой: эти роли не используются браузером.

Схема обеспечивает:

- UUID заявки передается клиентом, один и тот же при повторной попытке создания; дубликат PK отклоняется.
- Владелец определяется `auth.uid()`, новая заявка получает `new`. Клиент не может явно передать владельца, статус или даты при INSERT.
- Название/описание на сервере обрезаются по краям от пробелов, табуляции, CR/LF, form feed и vertical tab; пустая строка после этого запрещена. Длины: 1-160 и 1-10000 символов. Дополнительно UI обрезает whitespace через `trim()`.
- Категории: `bot`, `integration`, `report`, `other`; статусы: `new`, `in_progress`, `completed`.
- При UPDATE сервер обновляет `updated_at`. UUID, владелец и дата создания не изменяются клиентом.
- DELETE отсутствует. Существование чужой строки не раскрывается через SELECT/UPDATE: она невидима RLS.

## 4. Настроить email/password Auth

1. В Authentication включите Email/password provider.
2. В URL Configuration задайте Site URL опубликованного приложения и точные redirect URL, например `https://app.example.com/auth/callback` и `http://localhost:5173/auth/callback`. Замените пример реальным адресом; не используйте широкий wildcard в опубликованном окружении.

Для текущего демо Site URL: `https://latte.193-232-88-121.nip.io`; Redirect URL: `https://latte.193-232-88-121.nip.io/auth/callback`. Локальный redirect добавляется отдельно только для разработки.
3. Если подтверждение email включено, настройте custom SMTP с доступным отправителем и проверьте реальную доставку на два тестовых адреса. Успешный `signUp` без сессии означает ожидание подтверждения, а не вход.
4. Встроенный SMTP Supabase ограничен адресами участников команды и низкой частотой отправки. Для регистрации внешних проверяющих он не подходит. Альтернатива только для отдельно согласованного демонстрационного проекта - отключить подтверждение email и зафиксировать это ограничение в README. Не отключайте его молча.
5. Создайте пользователей A и B через интерфейс приложения, подтвердите email при выбранном режиме. В Authentication > Users скопируйте их UUID. Не вставляйте в тест пароли или JWT.

Источник ограничений почты: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Настройки и ограничения сервиса могут меняться.

## 5. Проверить A / B / anon в SQL Editor

Откройте [`requests_access.sql`](../supabase/tests/requests_access.sql). Замените ровно два UUID в начале на реальные UUID пользователей A и B. Выполните **весь** файл одним запуском как `postgres`. Не выделяйте только завершающий SELECT: надпись PASS без выполненных предыдущих проверок ничего не доказывает.

Скрипт проверяет существование двух Auth-пользователей, затем переключает роль и JWT claims внутри транзакции. Поэтому проверки выполняются как `authenticated`/`anon`, а не с обходом RLS от `postgres`. Тестовые заявки и все изменения откатываются заключительным `ROLLBACK`.

Покрытие: создание собственной записи, defaults, нормализация, повторный UUID, пустые и whitespace-only title/description (включая tabs/newlines), пределы длины, неверная category/status, запрет явного owner/status при INSERT, запрет изменения owner/id/created_at/updated_at, разрешенное редактирование своей заявки, запрет DELETE, чтение и изменение чужой заявки, запрет чтения/записи для anon. Успех - итоговая строка `PASS: ...`, без ошибок до нее.

Если тест падает, сохраните сообщение об ошибке без секретов, выполните `ROLLBACK;` в той же сессии и устраните причину. Не ослабляйте grants или RLS, чтобы приложение перестало выдавать ошибку. Проверяйте payload: лишние `user_id`, `status`, даты в INSERT запрещены намеренно.

## 6. Проверить реальный Data API и UI

SQL-проверка не заменяет проверку реальной сессии и опубликованного приложения:

1. Войти A, создать заявку, сохранить UUID; обновить страницу, выйти и снова войти - запись сохранилась.
2. Войти B в другом браузерном профиле. Список не содержит заявку A; прямой маршрут `/requests/<UUID-A>` не показывает ее.
3. Проверить прямой Data API через SDK с JWT пользователя B: SELECT по UUID-A возвращает пустой массив; UPDATE по UUID-A с `.select()` возвращает пустой массив и не меняет строку A. Нельзя считать один HTTP 200 доказательством успешного UPDATE: важен возвращенный результат.
4. Попробовать от B INSERT с `user_id=A`, INSERT со `status=completed`, UPDATE `user_id`/`created_at`, DELETE. Ожидается отказ в привилегиях, без изменения данных.
5. Использовать отдельный клиент без пользовательской сессии с publishable key: SELECT/INSERT/UPDATE/DELETE заявок запрещены. Ключ проекта передавать через конфигурацию, не публиковать реальные JWT в скриншотах и логах.
6. Проверить сохранение на узком экране, поиск вместе с фильтром, сетевую ошибку и повтор запроса с тем же UUID. Повторный INSERT не создает второй ряд.
7. Проверить конкурирующее редактирование: UPDATE должен фильтроваться по исходному `updated_at`. Ноль возвращенных строк - конфликт или отсутствие доступа; UI не должен показывать успешное сохранение.

Проверки доступа выполняются с publishable key и реальными JWT пользователей, **никогда** с service-role/secret key. После проверки вернитесь в A и убедитесь, что попытка B не изменила запись.

## 7. Конфигурация frontend

В локальном env-файле приложения задаются `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`. Эти значения встраиваются в сборку; их можно раскрывать браузеру. Любая переменная с префиксом `VITE_` считается публичной. Источник истины о доступе - SQL grants и RLS, а не секретность publishable key.

Если таблица не появилась в Data API сразу после миграции, проверьте, что `public` присутствует в exposed schemas, затем при необходимости выполните как `postgres`:

```sql
notify pgrst, 'reload schema';
```

Не добавляйте `ld_latte_private` в exposed schemas и не выдавайте широкие grants ради исправления ошибки cache/API.

Официальные основания: [RLS и grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [автоматическое включение RLS/event triggers](https://supabase.com/docs/guides/database/postgres/event-triggers), [привязка к auth.users](https://supabase.com/docs/guides/auth/managing-user-data).

## Статус проверки

Владелец сообщил об успешном выполнении миграции 30.10.2026. После этого живой anon SELECT к requests вернул 42501 permission denied вместо прежнего PGRST205. Локальный PostgreSQL/WASM тест миграции и SQL-проверок A/B/anon прошёл с автоматическим RLS и без него. Живой цикл двух пользователей и доставка подтверждения пока не проверены; пользователь выбрал SMTP с подтверждением email. Локальные тесты и запрет anon не заменяют живую A/B-проверку.
