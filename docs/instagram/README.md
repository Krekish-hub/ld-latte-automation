# План сбора статистики Instagram для LD LATTE

Дата проверки документации: **30 октября 2026**. Это результат задачи 2: проект подключения, без разработки интеграции и без запроса реальных доступов. Конкретный аккаунт, токен, первый ответ API и доступность настроек в кабинете компании не проверялись.

Материалы: [схема SVG](architecture.svg), [исходник Mermaid](architecture.mmd), [метрики](metrics.md), [проверка и диагностика](verification.md), [вопросы компании](questions.md), [официальные источники и ограничения исследования](sources.md).

## 1. Выбор способа подключения

Для новой интеграции основной вариант — **Instagram API with Unified Login**: именно его теперь рекомендует Meta. До реализации проверяем наличие совместимой конфигурации в кабинете приложения и business portfolio компании. Если эти условия не выполнены, выбираем один из двух других путей; не смешиваем токены, ID, host и permissions между ними. [Официальное сравнение](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login), [Overview](https://developers.facebook.com/documentation/instagram-platform/overview).

| Параметр | Основной: Unified Login | Instagram Login | Facebook Login, Page-linked |
|---|---|---|---|
| Кто может подключаться | Business/Creator | Business/Creator | Business/Creator |
| Вход владельца | Instagram или Facebook | Instagram | Facebook |
| Facebook Page | Не требуется | Не требуется | Нужна связанная Page |
| Business portfolio | Обязателен; приложение тоже принадлежит portfolio | Не обязателен для самого login flow | Зависит от конфигурации |
| Токен | Business Integration System User, в Dashboard — SUAT | Instagram User | Facebook User; Page token существует для соответствующих операций |
| API host | `graph.facebook.com` | `graph.instagram.com` | `graph.facebook.com` |
| Получение IG account ID | `/me/assigned_instagram_accounts` | ID из OAuth/профиля; проверить через account endpoint | `/me/accounts` → Page → `instagram_business_account.id` |
| Базовые права для Insights | `instagram_basic`, `instagram_manage_insights` | `instagram_business_basic`, `instagram_business_manage_insights` | `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`; для discovery — `pages_show_list` |

Последняя строка основана на [Insights requirements](https://developers.facebook.com/documentation/instagram-platform/insights) и [Facebook get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started). Для Page-role, выданной через Business Manager, Insights reference дополнительно указывает `ads_management` и `ads_read`: проверяем именно этот способ выдачи доступа, не добавляем рекламные права всем аккаунтам автоматически.

**Особенность Unified Login:** стандартная конфигурация Dashboard включает `instagram_manage_messages` как обязательное право вместе с `instagram_basic`, а также предлагает публикации, комментарии и рекламу. Технический специалист редактирует конфигурацию, добавляет `instagram_manage_insights` и убирает лишние необязательные права. Нельзя обещать конфигурацию только с двумя insights-scopes, не проверив кабинет: требование login-конфигурации отличается от минимальных прав конкретного endpoint. Для управления BISU-токенами через Management API дополнительно требуется `business_management`. Объясняем владельцу каждое оставшееся право. [Setup](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started), [permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions).

Если требуется совокупная статистика продвижения/рекламы по публикациям, отдельно согласуем Page-linked Facebook Login: текущий Media Insights reference помечает `total_views`, `total_likes`, `total_comments` как доступные **только** этому пути. Поддержку этих total-метрик в Unified Login не предполагаем. Обычная статистика аккаунта и органических публикаций покрывает исходный запрос; смысл «просмотров» нужно согласовать по [таблице метрик](metrics.md).

## 2. Связи и ответственные

Компания владеет Instagram-аккаунтами и business portfolio с активами. Назначенный владелец/администратор может выбрать правильный portfolio и поделиться нужными аккаунтами. Технический специалист имеет административный доступ к Meta app, серверу интеграции и тестовому хранилищу; личные пароли Instagram ему не передают. OAuth проходит на стороне Meta. Аналитик получает доступ к отчётам без токенов.

Для Page-linked пути дополнительно фиксируются пары Page ID ↔ Instagram ID и задачи пользователя на Page. Наличие доступа к Instagram в приложении телефона само по себе не доказывает права на нужную Page. [Overview: Pages и Tasks](https://developers.facebook.com/documentation/instagram-platform/overview).

Standard Access подходит для проверки с аккаунтами/людьми, имеющими необходимые роли. Для пользователей вне ролей приложения нужны Advanced Access к запрашиваемым permissions, App Review, Live mode; Overview также требует Business Verification для Advanced Access. Не обещаем срок одобрения. Сначала проверяем, подпадает ли внутренний сценарий компании под Standard Access. [Overview](https://developers.facebook.com/documentation/instagram-platform/overview), [Unified permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions).

## 3. От аккаунта до первого ответа: основной путь

| Шаг | Кто | Действие | Проверяемый результат |
|---|---|---|---|
| 1 | Владелец + аналитик | Составить список аккаунтов, типов, portfolio, ответственных; согласовать метрики, периоды, органику/рекламу, отчётный часовой пояс | Реестр активов и определений |
| 2 | Владелец | При необходимости перевести Personal в Business/Creator; убедиться в доступе к portfolio, которому принадлежат Instagram-активы | Аккаунт профессиональный, виден в нужном portfolio |
| 3 | Специалист | Создать/выбрать business-owned Meta app с use case Manage messaging & content on Instagram и Facebook Login for Business | Доступна вкладка API setup with Unified login |
| 4 | Специалист | Создать совместимую конфигурацию, проверить scopes, `config_id`, тип и срок токена; настроить контролируемый HTTPS redirect | Сохранён Login URL и спецификация прав |
| 5 | Специалист | Подготовить серверный OAuth callback, одноразовый проверяемый `state`, хранилище секретов, обработку отказа; подготовить и проверить HTTPS webhook по setup Meta | Корректный возврат без выдачи секретов браузеру |
| 6 | Владелец | Открыть Login URL, войти на Meta, выбрать portfolio и нужные IG-аккаунты, проверить и одобрить права | Meta возвращает authorization code |
| 7 | Сервер автоматически | Проверить OAuth state; обменять code через `graph.facebook.com/v26.0/oauth/access_token` сервер-сервер с Meta app ID/secret | Получен BISU token; код/секреты не журналируются |
| 8 | Сервер автоматически | Получить `/me?fields=client_business_id`, затем `/me/assigned_instagram_accounts?fields=id,username`, пройти все страницы | Список разрешённых Instagram ID, client business ID и привязка к соединению |
| 9 | Специалист + автоматика | Сверить ID/username с реестром; прочитать `followers_count`; выполнить отдельные Insights-запросы views и reach; получить media и одну публикацию | Ответы относятся к выбранному аккаунту; метрики и периоды распознаны |
| 10 | Специалист | Сохранить первый нормализованный снимок; сравнить с нативной статистикой за тот же период с учётом задержки | В отчёте есть источник, период, время выгрузки и статус полноты |
| 11 | Владелец + специалист | Пройти требуемые review/verification и Live mode до подключения людей вне ролей | Доступ проверен пользователем без developer-role, если он нужен |
| 12 | Автоматика | Включить расписание, мониторинг срока/отзыва доступа, повторное чтение свежих периодов | Есть журнал успешных выгрузок, оповещение и сценарий reconnect |

Шаги 3–8: [Unified get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started), [onboarding](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/business-onboarding), [authentication](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication). Проверка `state` — наше проектное требование защиты OAuth. Webhook из общего setup не заменяет регулярный опрос Insights; конкретные subscriptions включаем только для нужных и поддерживаемых событий.

Первые read-only запросы выполняются **по одному показателю**, без breakdown, чтобы изолировать ошибки. Версия `v26.0` соответствует reference на дату исследования; перед запуском ещё раз проверяется и фиксируется в конфигурации. Пример, не результат реального вызова:

```http
GET https://graph.facebook.com/v26.0/{IG_ACCOUNT_ID}?fields=id,username,followers_count
Authorization: Bearer {SERVER_SIDE_TOKEN}

GET https://graph.facebook.com/v26.0/{IG_ACCOUNT_ID}/insights?metric=views&period=day&metric_type=total_value&since={UNIX_START}&until={UNIX_END}
Authorization: Bearer {SERVER_SIDE_TOKEN}

GET https://graph.facebook.com/v26.0/{IG_ACCOUNT_ID}/insights?metric=reach&period=day&metric_type=total_value&since={UNIX_START}&until={UNIX_END}
Authorization: Bearer {SERVER_SIDE_TOKEN}

GET https://graph.facebook.com/v26.0/{IG_ACCOUNT_ID}/media?fields=id,media_type,media_product_type,timestamp
Authorization: Bearer {SERVER_SIDE_TOKEN}

GET https://graph.facebook.com/v26.0/{IG_MEDIA_ID}/insights?metric=views,reach
Authorization: Bearer {SERVER_SIDE_TOKEN}
```

Операционный HTTP-клиент должен редактировать секретные поля и заголовки в логах; примеры не содержат реальных токенов. ID публикации берётся из разрешённого account, не из URL поста. `/me` с BISU представляет system user, поэтому подставлять его ID вместо IG account ID нельзя. [Authentication](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication).

## 4. Альтернативные последовательности

**Instagram Login:** профессиональный аккаунт → Instagram product и Instagram App ID/secret → Business Login OAuth → code → POST `api.instagram.com/oauth/access_token` → short-lived Instagram User token → серверный обмен `graph.instagram.com/access_token?grant_type=ig_exchange_token` → account ID → те же `/insights` на `graph.instagram.com`. Используем `instagram_business_basic` + `instagram_business_manage_insights`. Facebook Page и `pages_show_list` сюда не переносим. [Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Insights](https://developers.facebook.com/documentation/instagram-platform/insights).

**Page-linked Facebook Login:** профессиональный IG связан с Page → человек имеет требуемые Page tasks → Facebook Login for Business → Facebook User token → `/me/accounts` со всеми страницами → сверка Page и `instagram_business_account.id` → профиль/media/insights на `graph.facebook.com`. В частности, Insights requirements указывает Facebook **User** token; не заменяем его Page token без проверки reference выбранной операции. Для поддержания доступа выполняем допустимый серверный long-lived exchange и проверяем фактические сроки. [Get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started), [tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived).

## 5. Поддержание доступа

| Путь | Срок и поддержание | Что сохраняем / когда нужен владелец |
|---|---|---|
| Unified | Срок задаётся конфигурацией и виден в preview; управление/обновление через BISU Token Management API | client business ID, config ID, срок из конфигурации/ответа, token reference; при отзыве приложения или переносе IG в другой portfolio — reconnect |
| Instagram Login | Long-lived — 60 дней; refresh через `/refresh_access_token?grant_type=ig_refresh_token`, когда токену ≥24 ч и он ещё действителен | Храним фактическое expires_in; проектно обновляем заранее, например за 7 дней; истёкший токен — новая авторизация |
| Facebook Login | Long-lived User обычно около 60 дней; серверный обмен с `fb_exchange_token`; IG refresh endpoint к нему неприменим | Проверяем срок/действительность и организуем повторный login до/при утрате доступа; Page token из long-lived User может не иметь даты окончания, но отзывается и не означает вечный доступ |

Источники: [Unified auth](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication), [IG Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [FB long-lived](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived). Конкретный вызов BISU Management API проверяется при реализации по linked reference; универсальный срок «60 дней» для Unified не заявляется. Отзыв и смена прав возможны раньше nominal expiry.

Секреты хранятся серверно и зашифрованно, отдельно от аналитических таблиц и Git; читатель отчёта их не получает. У доступа есть ответственный и кнопка/процедура отключения: остановить задания, удалить/отозвать секрет, обработать ранее сохранённые данные по согласованному сроку хранения. Сервисные журналы содержат account ID, correlation ID, код ошибки и время, но не raw code/token/secret.

## 6. Несколько аккаунтов и хранение

Предлагаем отдельный workflow/worker сбора и PostgreSQL-хранилище отчётности. Это проектное решение; его можно реализовать в n8n с серверными credentials. Оно не требует менять приложение заявок из задачи 3 и не даёт его пользователям доступ к Meta-секретам.

Реестр соединений хранит: `connection_id`, login path, app/config ID, client business ID при наличии, reference секрета, expiry/state. Связующая таблица account↔connection учитывает, что один Unified token может покрывать несколько аккаунтов одного portfolio. Разные portfolios подключаются отдельно и имеют отдельные токены. Username не используется как постоянный ключ. [Business onboarding](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/business-onboarding).

Хранилище разделяет:

- Аккаунты: scoped account ID, app/login path, username, тип, portfolio/Page при наличии, часовой пояс отчёта.
- Media: account ID, media ID, тип/продукт, дата публикации; cursor обходится полностью.
- Наблюдения: account ID, media ID или признак account-level, metric, period, since/until или lifetime, metric_type, breakdown dimensions, value, fetched_at UTC, API version и признак доступности/ошибки.
- Запуски: начало/конец, watermark последней успешной выгрузки, количество строк и незавершённые accounts/metrics.

Ключ нормализованного значения включает account, media-or-account scope, metric, period/range, metric_type, dimensions и API version. Повтор той же выгрузки обновляет значение и время наблюдения; raw-историю ревизий при необходимости храним отдельно. Lifetime-снимки публикаций не суммируем по датам загрузки. Поле `followers_count` — снимок на fetched_at, не исторический ряд, восстановленный задним числом. Не склеиваем ID разных app/login paths без отдельного доказанного mapping.

Начальное расписание — наше предложение, а не лимит Meta: аккаунты раз в сутки; свежие account-периоды повторно за последние 3 дня, поскольку возможна задержка до 48 часов; новые публикации чаще в первые дни, затем реже по согласованному сроку; Stories каждые 1–3 часа в пределах доступного окна с явным риском неполноты. Точный интервал зависит от числа аккаунтов и лимитов. Пропуск окна Story не восстанавливается обещанием полной истории. Backfill account-метрик ограничен доступными 90 днями, media — до 2 лет, Stories — отдельным 24-часовым ограничением. [Account/Media limits](metrics.md).

Обрабатываем аккаунты раздельно, ограничиваем concurrency, страницы читаем cursor-based, retries GET — с exponential backoff и jitter для временных сбоев; постоянные ошибки доступа переводят connection в reconnect_required. Ошибка одного account не помечает остальные как неуспешные. Квоты не фиксируем числом без проверенного rate-limit reference и реального ответа/usage headers. Прогресс сохраняется только после успешной записи данных.

В отчёте отображаем дату актуальности, неполные/недоступные метрики и объяснение различий с UI. `NULL/unavailable` не равен нулю. Reach уникален внутри запрошенного охвата: суммой дневных reach нельзя получить уникальный reach месяца, а суммой аккаунтов — уникальную аудиторию компании. [Определение reach](https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights).

## 7. Готовность к внедрению

Переход к реализации возможен после ответов на [вопросы](questions.md), проверки выбранного login flow в Dashboard и подтверждения каталога метрик на пилотном аккаунте. Приёмка проходит по [verification.md](verification.md): от доступа к активу до повторного чтения периода, отказа токена и сверки отчёта. В текущем тестовом выполнено исследование; строки о живом API в плане проверки не считаются выполненными.
