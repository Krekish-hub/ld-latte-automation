# План проверки и диагностики

**Статус:** только план. Живой API, реальные аккаунты и токены в тестовом не использовались. Проверки выполняет специалист вместе с владельцем на вымышленных/разрешённых тестовых публикациях, затем на одном пилотном аккаунте компании.

## Последовательная приёмка

| № | Что проверить | Действие и ожидаемое доказательство |
|---|---|---|
| 1 | Реестр и право подключения | Владелец сверяет username, тип Business/Creator, portfolio; для Facebook пути — Page ID и tasks. Сохраняем IDs и ответственного, без паролей |
| 2 | Meta app и login path | В Dashboard выбран нужный setup; app принадлежит portfolio для Unified; scopes/тип токена/expiry записаны. В работе только один согласованный путь на connection |
| 3 | Уровень доступа | Для разработки есть необходимые роли; для внешнего пользователя при необходимости review/Advanced/Live/Business Verification. Проверка developer-account не заменяет проверку обычного пользователя |
| 4 | OAuth успешно / отказ / неверный state | Точный HTTPS redirect; успешный code обменивается серверно; отказ не создаёт рабочее соединение; подменённый/повторный state отклоняется; токена в браузерных логах/URL приложения нет |
| 5 | Привязка актива | Unified: `/me?fields=client_business_id` и все страницы `/me/assigned_instagram_accounts`; ID/username сверяются с реестром. Обычный `/me` не считается IG account. Facebook: Page→IG ID. Instagram Login: OAuth/account ID |
| 6 | Текущее число подписчиков | `followers_count` успешно прочитан с временем наблюдения. Показатель подписок за период не подставляется вместо общего количества |
| 7 | Views и reach аккаунта | Отдельные запросы за явно заданный диапазон, period/metric_type; проверяем название, scope, форму `total_value`/`values`, description и fetched_at |
| 8 | Статистика публикации | Получить media ID через account edge с pagination; проверить FEED/Reel; запросить только допустимые метрики; carousel child не используется вместо родителя |
| 9 | Stories, если нужны | Тестовая Story младше 24 ч, достаточное число зрителей; запрос до истечения, несколько снимков; отдельно регистрируем отсутствие/порог/истечение. Проверка не обещает полную историю при пропуске окна |
| 10 | Сверка с UI | Аналитик выбирает те же account/media и окно, часовой пояс, органику/рекламу. При различии повторяем чтение после задержки, документируем определение, доступность и fetch time, не «подгоняем» значения |
| 11 | Сохранение и повтор | Дважды загрузить один диапазон: число нормализованных ключей не удвоилось; новое значение обновилось; raw revisions, если нужны, различимы; watermark двигается только после успешной записи |
| 12 | Несколько аккаунтов | Подключить два account одного portfolio и второй portfolio при наличии. Проверить отдельный connection/token там, где нужен; отказ одного account не останавливает другие; нет перемешивания ID |
| 13 | Сбои | Имитировать сетевой таймаут/5xx и временный отказ: ограниченный backoff, без бесконечного цикла. Отозвать тестовое соединение: reconnect_required и понятный запрос владельцу |
| 14 | Срок токена | Проверить фактический expiry/config; для IG Login — refresh действующего токена нужного возраста; для Unified — выбранный Management API/процедура reconnect. Истёкший/отозванный токен не объявляется обновлённым |
| 15 | Отчёт и доступ | Пользователь отчёта видит актуальность/неполноту/недоступность; не видит токены; выгрузка переживает перезапуск worker и не теряет прогресс |
| 16 | Завершение пилота | Каталог метрик с фактическими params/version зафиксирован, доступы и ответственные подтверждены; расписание/восстановление/ограничения согласованы |

## Диагностическая таблица

| Симптом | Что проверить по порядку | Действие |
|---|---|---|
| Нет вкладки Unified Login | Владение Meta app business portfolio, Facebook Login for Business и совместимость конфигурации | Исправить настройку app; не пытаться использовать Instagram User token как BISU |
| Нет Instagram login option | Instagram Login Compatible label; браузер уже вошёл в Facebook | Проверить config; `prompt=login` или Add another account |
| Не виден нужный IG | Personal вместо professional; другой portfolio; неверная учётная запись/права | Владелец выбирает правильный portfolio/аккаунт и подключает заново |
| Facebook `/me/accounts` пуст / нет IG связи | `pages_show_list`, Page tasks, выбранные при consent Pages, связь Page→IG; pagination | Исправить доступ владельца/связь/согласие; не искать данные по username сторонним скрейпингом |
| Access token error | Совпадение app/path/host/token; срок/отзыв; перенос IG в другой portfolio; удаление приложения | Для отозванного соединения остановить retries, запросить reconnect; не журналировать token |
| Permission/access error | Названный scope, grants, asset scope, app role/Standard/Advanced/Live; Page role через Business Manager | Запросить только нужные недостающие permissions и повторить consent; не лечить ошибку слепым расширением прав |
| Unknown/invalid metric или breakdown | API version, current reference, media_product_type, совместимость period/metric_type/breakdown | Запросить одну метрику без breakdown; убрать deprecated имена; уточнить метрико-специфические параметры |
| `data: []` / нет части метрик | Порог аудитории, задержка расчёта до 48 ч, владение media, доступный период, выбранный тип | Сохранить unavailable с причиной и fetch time; повторить допустимое окно, не записывать 0 |
| Story error 10 / нет результата | Возраст Story, <5 viewers, родительский ID, доступность 24-часового окна | Отметить порог/истечение; не трактовать любую ошибку 10 как одну и ту же причину |
| Значения расходятся с UI | Временной пояс/окно, lifetime vs day, органика vs promoted, задержка, региональные replies | Сверять одинаковую сущность/определение; фиксировать расхождения и время повторной проверки |
| Ошибка API integration helper | Он поддерживает Instagram User token, не BISU | Проверить BISU прямым read-only API-запросом, не объявлять токен невалидным по helper |
| Временные ошибки / квота | HTTP и Graph error body, доступные usage headers, частота/parallelism, повторные страницы | Ограничить concurrency, backoff/jitter, очередь по account; число квоты брать из актуальной документации и фактического ответа |
| Повторяются строки отчёта | Уникальный ключ, одинаковые since/until, dimensions, пересечение inclusive boundaries, pagination watermark | Идемпотентная запись; не суммировать повторные снимки |

Meta-основание симптомов onboarding/token/helper: [Unified troubleshooting](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting) и [authentication](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication). Метрики, задержки, Stories: [Account](https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights), [Media](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights). Facebook discovery: [get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started). Backoff, ключи хранения, CSRF state и раздельные очереди — предложенные инженерные меры, не заявленная квота или обещание Meta.

## Что сохранить как доказательство

Для каждого шага: дата/среда, login path/API version, account/media ID, параметры без секретов, HTTP status и Graph code/subcode при наличии, очищенный результат, ожидаемое/фактическое, ответственный. Для support: Meta app ID, config ID, время с часовым поясом, этап onboarding и текст ошибки. Не прикладывать access token, app secret, OAuth code, личный пароль или полный чувствительный payload. [Meta troubleshooting](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting).

Выходной критерий: пилотный аккаунт даёт согласованные показатели, повторная выгрузка идемпотентна, второй аккаунт изолирован, отзыв доступа замечается, отчёт показывает свежесть и ограничения. Ни один пункт живой проверки сейчас не отмечен выполненным.
