// Optional compatibility check INSIDE the installed n8n container.
// No Telegram token, credentials, network call or workflow execution is used.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
const base = process.env.N8N_NODES_DIST;
if (!base) throw new Error('Set N8N_NODES_DIST to the installed n8n-nodes-base/dist');
const require = createRequire(import.meta.url);
const { Telegram } = require(path.join(base, 'nodes/Telegram/Telegram.node.js'));
for (const count of [0, 2, 5, 9]) {
  let captured;
  const rows = Array.from({ length: count }, (_, i) => ({ row: { buttons: [{ text: `Услуга ${i + 1} & <тест>`, additionalFields: { callback_data: `svc:7d1a7700-0000-4000-8000-${String(i + 1).padStart(12, '0')}` } }] } }));
  const parameters = { resource: 'message', operation: 'sendMessage', chatId: 12345, text: 'Вы выбрали: &lt;тест&gt;', replyMarkup: count ? 'inlineKeyboard' : 'none', inlineKeyboard: { rows }, additionalFields: { appendAttribution: false, parse_mode: 'HTML' } };
  const context = {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _index, fallback) => parameters[name] ?? fallback,
    getNode: () => ({ name: 'Send reply', typeVersion: 1.2, type: 'n8n-nodes-base.telegram' }),
    getCredentials: async () => ({ accessToken: 'TEST_NOT_A_REAL_TOKEN', baseUrl: 'https://api.telegram.org' }),
    continueOnFail: () => false,
    helpers: {
      request: async options => { captured = options; return { ok: true, result: { message_id: 1 } }; },
      returnJsonArray: data => (Array.isArray(data) ? data : [data]).map(json => ({ json })),
      constructExecutionMetaData: data => data,
    },
  };
  await new Telegram().execute.call(context);
  assert.ok(captured.uri.endsWith('/sendMessage'));
  assert.equal(captured.body.parse_mode, 'HTML');
  assert.equal(captured.body.text, 'Вы выбрали: &lt;тест&gt;');
  if (count) {
    assert.equal(captured.body.reply_markup.inline_keyboard.length, count);
    assert.equal(captured.body.reply_markup.inline_keyboard[0][0].text, 'Услуга 1 & <тест>');
    assert.match(captured.body.reply_markup.inline_keyboard[0][0].callback_data, /^svc:/);
  } else assert.equal(captured.body.reply_markup, undefined);
}
console.log('PASS: installed Telegram node builds valid 0/2/5/9 keyboards and escaped HTML, without network.');
