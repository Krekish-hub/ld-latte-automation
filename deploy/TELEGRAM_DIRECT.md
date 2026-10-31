# Прямой HTTPS-вход Telegram на VPS n8n

Состояние 31.10.2026: вход перенесен с ретранслятора на **`https://hooks-latte.144-31-244-32.nip.io:88`**. Telegram снова доставляет сообщения: пользователь получил «Выберите услугу:». Inline-клавиатура в этом сообщении отсутствовала, ее формирование проверяется отдельно. Это еще не завершенная приемка бота.

Сайт заявок остается на прежнем сервере/имени. Для Telegram описанная ниже схема заменяет webhook-путь через HAProxy и SSH-туннель из [прежней инструкции](README.md); исторические проверки старого адреса не доказывают состояние нового входа.

```text
Telegram -> HTTPS TCP :88 на 144.31.244.32
         -> отдельный Caddy 2.11.7 / ld-latte-webhook.service
         -> HTTP 127.0.0.1:5678 / контейнер ld-latte-n8n

ACME CA -> HTTP TCP :80 -> Caddy HTTP-01 challenge
Администратор -> SSH-туннель -> n8n editor 127.0.0.1:5678
```

TCP 443/8443 занят существующим Xray и остается без изменений. Telegram поддерживает HTTPS-webhook на порту 88; HTTP-01 требует внешней доступности TCP 80 независимо от порта приложения. TLS-ALPN challenge отключен, HTTP-редиректы выключены, Caddy admin API отключен. [Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook), [Caddy options](https://caddyserver.com/docs/caddyfile/options), [Caddy TLS](https://caddyserver.com/docs/caddyfile/directives/tls).

## Файлы и границы

| В репозитории | На VPS |
|---|---|
| [Caddyfile.telegram-direct](Caddyfile.telegram-direct) | `/etc/ld-latte/webhook.Caddyfile` |
| [ld-latte-webhook.service](ld-latte-webhook.service) | `/etc/systemd/system/ld-latte-webhook.service` |
| Официальный Caddy binary, версия 2.11.7 | `/usr/local/bin/ld-latte-caddy` |
| Постоянное состояние ACME/TLS, вне Git | `/var/lib/ld-latte-webhook/` |

Это отдельная systemd-служба с DynamicUser, StateDirectory, только CAP_NET_BIND_SERVICE, ProtectSystem=strict, ProtectHome=yes, PrivateTmp, MemoryMax=128M, CPUQuota=20%. Постоянное состояние разрешено в StateDirectory. Не удаляйте его при обычном обновлении: там сертификаты и ключ ACME. Приватные ключи не переносятся в репозиторий.

Caddy пропускает только `/webhook/*` и `/healthz` на loopback n8n; остальные пути получают 404. Нативный заголовок `X-Telegram-Bot-Api-Secret-Token` проходит без подмены и проверяется самим n8n. `/rest/*`, `/setup`, `/webhook-test/*` и редактор наружу не открываются. Публичный `/healthz` проверяет процесс n8n, а не доступ к Supabase или полную работу workflow. Access log с телами/заголовками не включен.

## Порядок установки или воспроизведения

Все команды ниже выполняются на **VPS n8n**, не на сервере сайта. Для уже работающего экземпляра сначала сверить текущие файлы; не повторять установку вслепую.

1. Снять состояние `ss -lntup`, `docker ps`, памяти, службы Xray и текущих systemd units. Убедиться, что 80/88 свободны и разрешены во внешнем firewall провайдера. Не включать новый firewall и не перестраивать Docker/VPN/Xray сети ради этого сервиса.
2. Проверить DNS: имя `hooks-latte.144-31-244-32.nip.io` должно разрешаться в `144.31.244.32`. Проверить A/AAAA и исключить устаревшую AAAA-запись.
3. Установить Caddy **2.11.7** из официального download API Caddy для архитектуры этого VPS в `/usr/local/bin/ld-latte-caddy`, владелец root, mode 0755. Проверить HTTPS-источник, версию (`ld-latte-caddy version`) и зафиксировать SHA-256 полученного файла в закрытом журнале деплоя. Не подменять системный `/usr/bin/caddy` и не использовать плавающую последнюю версию при воспроизведении. Источник: [официальная установка Caddy](https://caddyserver.com/docs/install).
4. Сохранить предыдущие binary/config/unit отдельно в закрытом каталоге администратора, если они уже существуют. Установить Caddyfile и unit из таблицы выше. `/etc/ld-latte` и конфигурация должны быть доступны DynamicUser для чтения: каталог 0755, Caddyfile 0644; в этом файле нет секретов. Секретный `n8n.env` остается 0600 и не читается Caddy.
5. Проверить конфигурацию и unit, затем запустить:

   ```sh
   /usr/local/bin/ld-latte-caddy validate --config /etc/ld-latte/webhook.Caddyfile --adapter caddyfile
   systemd-analyze verify /etc/systemd/system/ld-latte-webhook.service
   systemctl daemon-reload
   systemctl enable --now ld-latte-webhook.service
   systemctl is-active ld-latte-webhook.service
   journalctl -u ld-latte-webhook.service -n 40 --no-pager
   ```

   При запуске проверки вручную под root Caddy может создать свой отдельный data-каталог. Рабочее состояние службы определяется `StateDirectory`/storage из конфигурации. Не публиковать полные логи без просмотра: там могут быть приватные пути webhook.
6. Проверить HTTPS и ограничения путей с внешнего компьютера, **без `-k`**:

   ```sh
   curl --fail --show-error https://hooks-latte.144-31-244-32.nip.io:88/healthz
   curl --silent --output /dev/null --write-out '%{http_code}\n' https://hooks-latte.144-31-244-32.nip.io:88/rest/settings
   curl --silent --output /dev/null --write-out '%{http_code}\n' https://hooks-latte.144-31-244-32.nip.io:88/setup
   curl --silent --output /dev/null --write-out '%{http_code}\n' https://hooks-latte.144-31-244-32.nip.io:88/webhook-test/probe
   ```

   `/healthz` должен вернуть 200; закрытые пути - 404. На TCP 80 допускается только служебное поведение HTTP-01, а не открытый редактор. HTTP redirect на 443 здесь намеренно не используется.
7. В закрытом `/opt/ld-latte/n8n.env` выставить:

   ```dotenv
   N8N_HOST=hooks-latte.144-31-244-32.nip.io
   N8N_PROTOCOL=https
   N8N_PORT=5678
   N8N_WEBHOOK_URL=https://hooks-latte.144-31-244-32.nip.io:88/
   N8N_EDITOR_BASE_URL=http://localhost:5678
   N8N_PROXY_HOPS=1
   ```

   `N8N_PORT` остается внутренним 5678, а не публичным 88. Сохранить прежние encryption key, CA и остальные настройки. Если env меняется, пересоздать только контейнер n8n по существующему run-скрипту и процедуре резервной копии; обычный Docker restart не обновляет env. Убедиться, что 5678 опубликован только на `127.0.0.1`.
8. Проверить активность того же workflow и прикрепленные Telegram/Postgres credentials через закрытый редактор. Смена публичного ingress не требует нового workflow/новых токенов. Повторно зарегистрировать production webhook новым URL с прежним нативным secret token и `drop_pending_updates=false`. Не терять очередь и не сбрасывать ее ради «чистой» проверки.

   Токен бота и secret token не помещать в shell history, Git, workflow export или журнал. Предпочтительна штатная регистрация Telegram Trigger. При ручной регистрации использовать доверенный административный инструмент с секретами в памяти, передавать `secret_token`, `allowed_updates` как у Trigger (`message`, `callback_query`) и `drop_pending_updates=false`. Не изменять путь production webhook и не включать test-trigger на том же боте.

## Проверки после регистрации webhook

1. `getWebhookInfo`: точный HTTPS host и **порт 88**, правильный production path, нет нового `last_error_date`, очередь `pending_update_count` уменьшается. Сохраненный исторический `last_error_message` сам по себе не означает новый сбой; сопоставлять timestamp с новым тестом.
2. POST на настоящий production path **без secret header** отклоняется 403 установленным Trigger. Не отправлять правильный секрет с вымышленным событием ради теста: это способно вызвать настоящий workflow/сообщение.
3. Отправить `/start` от настоящего пользователя в личный чат, убедиться, что новое n8n execution успешно и ответ появился в Telegram. 200 `/healthz` или успешный `setWebhook` этого не доказывают.
4. Убедиться, что видны inline-кнопки; нажать разные ID; получить актуальное имя. Далее воспроизвести 2/5/9/0, rename/disable и восстановить fixture-2. Сейчас доставка подтверждена, но эта проверка клавиатуры еще не завершена.
5. Сравнить исходное состояние Xray/443/8443, Docker, памяти и доступность сайта с состоянием после изменения. Проверить, что новые TCP listeners принадлежат только ожидаемой службе, а n8n editor не открылся наружу.

## Обновление и откат

`admin off` означает отсутствие обычного `caddy reload` через admin API. Сначала выполнить `validate`, затем `systemctl restart ld-latte-webhook.service` в согласованное короткое окно. Не открывать admin API наружу ради reload. При ошибке вернуть только предыдущие Caddyfile/binary/unit, `daemon-reload` при изменении unit, затем перезапустить эту службу. Состояние сертификатов сохранить.

Для полного отказа от прямого ingress:

1. Сначала проверить работоспособность прежнего HTTPS webhook-пути через ретранслятор. Восстановить согласованные n8n URL-настройки и регистрацию прежнего URL с тем же secret token и `drop_pending_updates=false`.
2. Проверить доставку реального сообщения на прежнем пути. Если прежний маршрут недоступен, не объявлять откат успешным: очередь Telegram должна оставаться сохраненной.
3. Только после переключения остановить `systemctl disable --now ld-latte-webhook.service`. Убирать внешние правила 80/88 только если они были созданы исключительно для этой службы и не используются другими сервисами.
4. Не удалять volume n8n, credentials, encryption key, StateDirectory, контейнеры Xray/VPN или данные сайта. Сохранить закрытую резервную копию конфигурации.

Порядок отключения важен: остановка Caddy до переключения webhook временно прерывает доставку. Этот deploy не требует остановки Xray, переноса 443/8443, изменения SSH trust или обновления ОС.
