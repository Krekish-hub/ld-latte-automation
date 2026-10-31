# Источник услуг: Supabase Postgres

Источник - `public.services`: `id uuid`, `name text`, `active boolean`, `sort_order integer`. Вымышленные услуги не связаны с заявками пользователей. Бот читает таблицу при каждом `/start` и при callback по стабильному ID; изменение услуг не требует правки workflow.

## 1. Создать таблицу и отдельную роль

В Dashboard нужного проекта откройте SQL Editor, роль `postgres`. Выполните целиком [`202610300002_services.sql`](../../supabase/migrations/202610300002_services.sql).

Миграция не требует таблицы `requests`, не меняет ее и не меняет глобальные default privileges. Она создает таблицу, RLS, индекс сортировки и новую роль `n8n_services_reader`: LOGIN, без superuser/BYPASSRLS/создания БД и ролей/наследования, максимум три подключения. Роли выданы только CONNECT к текущей БД, USAGE `public` и SELECT `services`; RLS разрешает только `active = true`. `anon` и `authenticated` не получают доступа к услугам.

Это однократная миграция: если роль или таблица уже существуют, запуск намеренно падает. Не удаляйте их автоматически; сначала выясните происхождение. При ошибке в текущей SQL-сессии выполните `ROLLBACK;`. Если проект ранее открыл `auth.users` или `requests` через PUBLIC grants, защитная проверка отклонит миграцию, не изменяя чужие права. Такие нестандартные grants нужно отдельно изучить.

Автоматический trigger включения RLS в Supabase можно оставить включенным: повторное явное `ENABLE ROW LEVEL SECURITY` совместимо с ним. Пароля в миграции нет, и до следующего шага новая роль не сможет пройти парольную аутентификацию.

## 2. Задать пароль без публикации

1. Создайте отдельный случайный пароль в менеджере паролей: не менее 32 случайных символов. Удобен base64/base64url без одинарных кавычек. Не используйте пароль `postgres`, пароль пользователя приложения или ключ Supabase.
2. В приватном административном SQL Editor выполните, заменив заглушку:

   ```sql
   alter role n8n_services_reader password '<NEW_RANDOM_PASSWORD>';
   ```

3. Пароль сохраните только в менеджере паролей и n8n Credentials. SQL Editor может сохранять текст запросов/историю: запрос с реальным паролем не сохраняйте как общий snippet, не отправляйте в чат/репозиторий и не снимайте его на видео. При доступности удаления приватного запроса удалите его после применения. Сам SQL Editor не является хранилищем секретов.
4. Не передавайте пароль в строке команды, имени credential, workflow JSON, SQL запроса Postgres node или скриншотах. В экспорте workflow должны остаться только ссылки на локальные credentials, без значений секретов.

Для ротации повторите `ALTER ROLE` с новым паролем, обновите credential, проверьте **новое** подключение и `/start`. Уже открытые подключения могут жить до закрытия; при срочном отзыве доступа администратор отдельно завершает сессии этой роли. `ALTER ROLE ... NOLOGIN` закрывает новые входы, но не существующие сессии.

## 3. Настроить Postgres credential в n8n

В Supabase **Connect** получите параметры **Shared Pooler / Session mode** для проекта. Берите реальные host/port/database из Dashboard, не копируйте регион/порт из чужого примера. Shared pooler удобен для IPv4-сервера. Для custom-role username имеет вид `n8n_services_reader.<PROJECT_REF>`, тогда как прямое подключение использует `n8n_services_reader` без суффикса. [Supabase: подключение и pooler](https://supabase.com/docs/guides/database/connecting-to-postgres).

Создайте Postgres credential, например `LD LATTE services (read only)`:

| Поле | Значение |
|---|---|
| Host | Точный shared-pooler hostname из Connect |
| Database | Значение из Connect, обычно `postgres` |
| User | `n8n_services_reader.<PROJECT_REF>` |
| Password | Пароль только этой роли из шага 2 |
| Port | Порт выбранного session pooler из Connect |
| SSL | Require |
| Ignore SSL Issues | Выключено |
| Maximum Connections | 2 (у роли лимит 3) |

Не отключайте проверку TLS ради успешного подключения. Если n8n не доверяет цепочке, установите CA, полученный из доверенного источника Supabase, в доверенное хранилище экземпляра n8n; проверьте hostname и актуальность сертификата. SSH tunnel для исходящего подключения обычно не нужен. [n8n: Postgres credentials](https://docs.n8n.io/integrations/builtin/credentials/postgres/).

На нашем экземпляре цепочка pooler требует Supabase Root 2021 CA. Сертификат установлен в постоянный volume, `NODE_EXTRA_CA_CERTS` задан в закрытом env-файле. `Ignore SSL Issues` остаётся выключенным. Установка и отпечаток приведены в [инструкции размещения](../../deploy/README.md#доверие-к-сертификату-supabase).

Session mode выбран для простоты совместимости клиента; transaction pooler можно использовать после отдельной проверки, учитывая ограничения prepared statements/session state. Не подменяйте credential паролем `postgres`, если custom-role не подключается: сначала проверьте username с project ref, режим/порт, пароль, TLS, сетевые ограничения и поддержку роли выбранным pooler.

В workflow используются короткие параметризованные SELECT. Внутреннюю SQLite-БД n8n не переключаем на этот credential.

```sql
-- /start: перечитать все доступные услуги, число кнопок не зашито в запрос.
select id, name from public.services
where active = true order by sort_order, id;

-- callback: $1 - проверенный UUID, переданный через Query Parameters узла.
select id, name from public.services
where id = $1::uuid and active = true;
```

Даже без `active = true` в SELECT RLS скрывает отключенные строки. RLS не заменяет обработку ошибок: недоступность БД отличается от пустого списка. В callback нельзя конкатенировать произвольный пользовательский текст в SQL.

## 4. Воспроизводимые наборы 0 / 2 / 5 / 9

Через SQL Editor как `postgres` примените один нужный файл:

- [`services-0.sql`](../../supabase/fixtures/services-0.sql)
- [`services-2.sql`](../../supabase/fixtures/services-2.sql)
- [`services-5.sql`](../../supabase/fixtures/services-5.sql)
- [`services-9.sql`](../../supabase/fixtures/services-9.sql)

Каждый файл UPSERT-ом восстанавливает имена, порядок и активность **только девяти** фиксированных UUID `7d1a7700-0000-4000-8000-000000000001` ... `000000000009`. Файлы повторяемы и не меняют посторонние услуги. Число в имени относится именно к этому набору: если в таблице есть другие активные услуги, бот покажет и их. Для показа ровно 0/2/5/9 используйте отдельный тестовый проект без посторонних активных услуг. Нельзя делать `UPDATE services SET active=false` ради демонстрации.

[`services-edit-examples.sql`](../../supabase/fixtures/services-edit-examples.sql) содержит отдельные примеры добавления десятой услуги, переименования первой, отключения первой и удаления только десятой. Выполняйте примеры **по одному**, между ними отправляйте `/start` и проверяйте старые кнопки. Перед повтором наборов удалите только дополнительный UUID примером cleanup; затем нужный fixture восстановит исходные девять строк.

## 5. Проверить SQL-доступ до подключения бота

В SQL Editor как `postgres` после fixture-2 выполните целиком:

```sql
begin;
set local role n8n_services_reader;
select current_user;
select id, name from public.services order by sort_order, id;
select count(*) as visible_fixture_rows from public.services
where id in (
  '7d1a7700-0000-4000-8000-000000000001',
  '7d1a7700-0000-4000-8000-000000000002',
  '7d1a7700-0000-4000-8000-000000000003',
  '7d1a7700-0000-4000-8000-000000000004',
  '7d1a7700-0000-4000-8000-000000000005',
  '7d1a7700-0000-4000-8000-000000000006',
  '7d1a7700-0000-4000-8000-000000000007',
  '7d1a7700-0000-4000-8000-000000000008',
  '7d1a7700-0000-4000-8000-000000000009'
);
rollback;
```

Ожидается роль `n8n_services_reader`, только активные строки и `visible_fixture_rows=2`. При fixture-0 роль должна видеть 0 строк этого набора.

Административная проверка grants без чтения данных:

```sql
select
  has_table_privilege('n8n_services_reader', 'public.services', 'SELECT') as can_select,
  has_table_privilege('n8n_services_reader', 'public.services', 'INSERT') as can_insert,
  has_table_privilege('n8n_services_reader', 'public.services', 'UPDATE') as can_update,
  has_table_privilege('n8n_services_reader', 'public.services', 'DELETE') as can_delete,
  has_table_privilege('n8n_services_reader', 'auth.users', 'SELECT') as can_read_auth;

-- Выполнить только если requests уже создана другой миграцией.
select has_table_privilege('n8n_services_reader', 'public.requests', 'SELECT') as can_read_requests;
```

Ожидается только `can_select=true`, остальные false. Проверьте также запрет INSERT/UPDATE/DELETE реальным запросом под `SET LOCAL ROLE n8n_services_reader` в отдельных транзакциях с `ROLLBACK`, а не под ролью postgres. Ошибка привилегий ожидаема; после нее завершите транзакцию `ROLLBACK;`.

Затем выполните SELECT через реальный n8n credential. SQL Editor с `SET ROLE` проверяет grants/RLS, но **не** пароль, TLS, Supavisor, доступность сети или ограничение числа соединений. Успехом подключения считаем реальный SELECT из n8n, затем живые `/start` и callback. Пустой SELECT должен продолжать ветку workflow, чтобы бот отправил сообщение об отсутствии услуг.

## 6. Чего эта инструкция не утверждает

Миграция/fixtures проверяются локально отдельно от настоящего Supabase. Применение в облачном проекте, установка пароля, подключение n8n через pooler, TLS и работа Telegram считаются выполненными только после соответствующих живых проверок. Проверка существующих requests не требует ее схемы для создания services и никогда не читает содержимое заявок.
