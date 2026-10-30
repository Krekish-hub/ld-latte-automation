# Официальные источники и границы проверки

Дата чтения: **30.10.2026**. Ниже только первоисточники Meta. Ссылки без `.md` открывают обычную документацию; при исследовании прочитаны официальные Markdown-представления тех же страниц, указанные в [Meta llms.txt](https://developers.facebook.com/documentation/instagram-platform/llms.txt). Сторонние блоги, GitHub-копии документации и скриншоты не используются как доказательство API-контракта.

## Прочитанные источники

| ID | Источник | Что проверено |
|---|---|---|
| M01 | [Instagram Platform Overview](https://developers.facebook.com/documentation/instagram-platform/overview) | Три setup, рекомендуемый Unified, professional accounts, Page/portfolio, Standard/Advanced, review/verification, hosts и роли |
| M02 | [Instagram API with Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login) | Рекомендуемый путь новых интеграций, Page не нужен, portfolio обязателен, BISU вместо person-bound token |
| M03 | [Unified get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started) | App prerequisites, config/default permissions, callback/webhook, обмен code, discovery business/account IDs, Live/Review |
| M04 | [Unified authentication and access tokens](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication) | SUAT/BISU, config-dependent expiration, server storage, Management API, `/me` не IG account, причины отзыва |
| M05 | [Unified permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions) | `instagram_*`, insights, `business_management` для BISU management, различие default config и endpoint permissions |
| M06 | [Unified business onboarding](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/business-onboarding) | Выбор portfolio/assets, несколько аккаунтов, отдельные соединения разных portfolios, consent и reconnect |
| M07 | [Unified eligibility and troubleshooting](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting) | Невидимые настройки/accounts, роли, helper limitations, безопасный support context |
| M08 | [Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login) | Professional account без Page, host family и ограничения ads/tagging |
| M09 | [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login) | OAuth code/redirect, short→long-lived exchange, серверный app secret, 60 дней, refresh ≥24 ч и до expiry |
| M10 | [Facebook Login get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started) | Page-linked prerequisites, `pages_show_list`, `/me/accounts`, Page→IG ID, media discovery |
| M11 | [Facebook long-lived access tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived) | User exchange, около 60 дней, server-side secret, Page token без nominal expiry всё равно отзываем |
| M12 | [Insights guide](https://developers.facebook.com/documentation/instagram-platform/insights) | Права трёх путей, 90 дней account retention, один user на вызов, UTC, отсутствие данных ≠0, ограничения webhook |
| M13 | [Instagram Account Insights](https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights) | v26.0, views/reach/follows_and_unfollows, period/type/breakdown, пороги, задержки, range, deprecated impressions |
| M14 | [Instagram Media Insights](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights) | Media matrix, 2 года, Stories 24 ч, 48 ч delay, organic vs total, carousel, регионы и lifetime |
| M15 | [IG User reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user) | Поле `followers_count`, account ID, profile permissions и синтаксис fields |

## Как проверялись страницы

Встроенное web-чтение `developers.facebook.com` возвращало HTTP 429 или недоступность. Обычный read-only HTTP-запрос к официальному сайту вне сетевой песочницы успешно получил официальные Markdown-страницы. Для references использовались пути из Meta llms.txt; никакие прокси-копии и аккаунты не требовались. Чтение documentation не является вызовом Graph API и не доказывает доступность конкретного permission в кабинете компании.

Официальная [Meta Instagram Postman collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) была просмотрена через поисковую индексацию, но содержит более ранние примеры и не используется как источник актуального перечня insights permissions, токенов и метрик.

## Разрешённые расхождения и оставшиеся проверки

1. Общий Insights guide содержит старые примеры с impressions/profile_views. Для новой реализации выбран актуальный Account/Media reference; deprecated имена не перенесены в примеры запросов.
2. В Account reference есть несогласованность `follow_type`/`follower_type` между общей таблицей и строками метрик. Разбивки необязательны для исходного задания; до использования каждая комбинация проверяется пилотом.
3. В Media reference общий список period шире, чем описание response с фиксированным lifetime. План использует lifetime-снимки, не обещает дневную media-историю и не подменяет account-period параметрами media.
4. Insights `follower_count` упоминается в limitations, но не превращён в готовый рецепт ежедневного общего числа подписчиков. Для обязательного общего количества выбран подтверждённый `followers_count` из IG User.
5. Демография сверх обязательного задания: reference содержит legacy timeframe-примеры. Не предлагаем их без отдельной проверки; утверждаем только документированные пороги/ограничения.
6. `total_views/total_likes/total_comments` в Media reference ограничены Facebook Login. Даже при наличии Unified не обещаем их по аналогии. Конкретный API token/type для операции проверяется по requirement этой операции.
7. Rate-limit guide и общий Graph error-handling guide при дополнительной проверке вернули HTML вместо читаемого содержимого. **Численные квоты, универсальные коды ошибок и гарантированный retry SLA не подтверждены и не заявлены.** Перед эксплуатацией требуется перечитать [rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/) и [error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/), проверить реальные error body и usage headers. Ограничение concurrency/backoff — наше инженерное предложение.
8. Для Unified expiry берётся из config preview; точный Management API вызов и допустимая конфигурация сроков должны быть проверены при реализации по ссылке из M04. Не переносим Instagram User refresh на BISU.
9. Реальные Graph-запросы, доступы LD LATTE, Dashboard компании, App Review, delivery webhooks, refresh и совпадение с UI не проверялись. Это сознательная граница задачи 2; исполняемый план проверки находится в [verification.md](verification.md).

Все интервалы расписания, модель хранения, idempotency keys, мониторинг, OAuth state и роли отчётности обозначают предложенную архитектуру. Они не выдаются за требования Meta или уже выполненную интеграцию.
