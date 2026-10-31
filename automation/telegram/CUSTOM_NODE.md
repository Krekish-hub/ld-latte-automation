# Отправка динамической клавиатуры

Workflow требует локальный узел `CUSTOM.ldLatteTelegram`, исходник — `custom/LdLatteTelegram.node.js`. Это небольшой готовый CommonJS-модуль без npm-зависимостей, не пакет из community registry. Нативные Telegram Trigger и Answer callback сохраняются.

Причина: fixed collection нативного Send Message при сохранении в редакторе превращал expression массива rows в пустые объекты. Отдельный тест готового HTTP-тела не обнаруживал эту ошибку. Новый узел принимает клавиатуру в обычном JSON-поле и не использует fixed collection.

## Установка

На n8n-хосте из корня checkout репозитория:

```sh
docker exec -u 0 ld-latte-n8n mkdir -p /home/node/.n8n/custom/nodes
docker cp automation/telegram/custom/LdLatteTelegram.node.js ld-latte-n8n:/home/node/.n8n/custom/nodes/LdLatteTelegram.node.js
docker exec -u 0 ld-latte-n8n chown -R 1000:1000 /home/node/.n8n/custom
docker restart ld-latte-n8n
```

Каталог входит в постоянный volume `ld_latte_n8n_data`, поэтому переживает пересоздание контейнера. Для другого UID используйте пользователя своего образа. Перезапускается только n8n. После старта обновите страницу редактора и импортируйте workflow. Не включайте глобальный доступ к env или установку сторонних пакетов ради этого узла.

В `Send reply` выберите тот же **Telegram API** credential, что у trigger/answer callback. Токен читается через штатный `getCredentials`, не переносится в workflow, Code node, env или выходные данные. Запросы идут только к `https://api.telegram.org`; произвольный base URL не поддерживается. Ошибки не содержат URL с токеном, автоматические повторы отправки выключены.

`keyboard` принимает массив строк Telegram: `[[{"text":"Название","callback_data":"svc:<UUID>"}]]`. Пустой массив отправляет только текст. Допустимы только `text` и `callback_data`; callback ограничен 64 байтами UTF-8. Текст отправляется в HTML-режиме; выбранное имя экранируется в Prepare reply.

## Проверка

```sh
node automation/telegram/build-workflow.mjs
node --test automation/telegram/tests/*.test.mjs
```

Тест полного пути разрешает bindings реального экспортированного workflow и проверяет тело запроса для 0/2/5/9 услуг. HTTP подменён: тест не отправляет сообщения и не доказывает живую доставку. Для приёмки отдельно выполнить `/start`, callbacks, переименование/отключение услуги и пустой список.

Официальная основа: [установка private nodes](https://docs.n8n.io/connect/create-nodes/deploy-your-node/install-private-nodes.md), [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage). Фактическая загрузка и формат узла сверяются с установленным n8n 2.45.6.
