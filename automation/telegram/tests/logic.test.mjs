import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeUpdate, prepareReply } from '../logic.mjs';
const message = text => ({ message: { chat: { id: 12345, type: 'private' }, text } });
const callback = data => ({ callback_query: { id: 'query-1', message: { chat: { id: 12345, type: 'private' } }, data } });
const services = Array.from({ length: 9 }, (_, i) => ({ id: `7d1a7700-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `Услуга ${i + 1}` }));
test('start and start with mention/deep link are read requests', () => {
  for (const text of ['/start', '/start@ZmeiiniyBot', '/start referral', ' /start ']) assert.equal(normalizeUpdate(message(text)).kind, 'start');
  assert.equal(normalizeUpdate(message('/start@another_bot')).kind, 'hint');
});
test('only supported private chat events are handled', () => {
  assert.equal(normalizeUpdate({}).kind, 'ignore');
  assert.equal(normalizeUpdate({ message: { chat: { id: -12, type: 'group' }, text: '/start' } }).kind, 'ignore');
  assert.equal(normalizeUpdate(message('/help')).kind, 'hint');
});
test('callback validates stable UUID before a parameterized query', () => {
  assert.equal(normalizeUpdate(callback(`svc:${services[0].id}`)).serviceId, services[0].id);
  for (const value of ['svc:1;DROP TABLE services;', 'x', 'svc:', '']) {
    const event = normalizeUpdate(callback(value)); assert.equal(event.kind, 'hint'); assert.equal(event.queryId, 'query-1'); assert.equal(event.serviceId, null);
  }
});
for (const count of [0, 2, 5, 9]) test(`dynamic menu has ${count} active buttons`, () => {
  const reply = prepareReply(normalizeUpdate(message('/start')), { services: services.slice(0, count) });
  assert.equal(reply.rows.length, count); assert.equal(reply.hasButtons, count > 0);
  for (const row of reply.rows) assert.ok(Buffer.byteLength(row.row.buttons[0].additionalFields.callback_data, 'utf8') <= 64);
  if (!count) assert.match(reply.text, /нет доступных услуг/);
});
test('callback returns current name and handles a missing/disabled service', () => {
  const event = normalizeUpdate(callback(`svc:${services[0].id}`));
  assert.equal(prepareReply(event, { services: [{ ...services[0], name: '<Переименовано> & "новое"' }] }).text, 'Вы выбрали: &lt;Переименовано&gt; &amp; "новое"');
  assert.match(prepareReply(event, { services: [] }).text, /больше недоступна/);
});
test('source failure and empty catalog are distinct', () => {
  const event = normalizeUpdate(message('/start'));
  for (const result of [{ error: 'private server details' }, {}, { services: 'invalid json' }]) assert.match(prepareReply(event, result).text, /Не удалось загрузить/);
  assert.doesNotMatch(prepareReply(event, { error: 'secret' }).text, /secret/);
  assert.equal(prepareReply(event, { services: JSON.stringify(services) }).rows.length, 9);
});
test('export embeds tested functions and keeps aggregate query/credentials safe', async () => {
  const workflow = JSON.parse(await readFile(new URL('../workflow.json', import.meta.url), 'utf8'));
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.every(n => !n.credentials));
  assert.deepEqual(workflow.nodes.find(n => n.name === 'Telegram updates').parameters.updates, ['message', 'callback_query']);
  const sql = workflow.nodes.find(n => n.name === 'Read active services');
  assert.match(sql.parameters.query, /\$1::uuid/); assert.match(sql.parameters.query, /coalesce\(jsonb_agg/);
  const normalizer = workflow.nodes.find(n => n.name === 'Normalize update');
  const output = new vm.Script(`(function(){${normalizer.parameters.jsCode}})()`).runInNewContext({ $input: { first: () => ({ json: message('/start') }) } });
  assert.equal(output[0].json.kind, 'start');
  const builder = workflow.nodes.find(n => n.name === 'Prepare reply');
  const response = new vm.Script(`(function(){${builder.parameters.jsCode}})()`).runInNewContext({ $: () => ({ first: () => ({ json: normalizeUpdate(message('/start')) }) }), $input: { first: () => ({ json: { services } }) } });
  assert.equal(response[0].json.rows.length, 9);
});
