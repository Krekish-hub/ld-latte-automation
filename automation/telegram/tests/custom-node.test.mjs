import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { LdLatteTelegram } = require('../custom/LdLatteTelegram.node.js');
const token = '123456789:PRIVATE_TEST_CREDENTIAL_NOT_REAL';
const keyboardFor = count => Array.from({ length: count }, (_, index) => [{
  text: `Услуга ${index + 1} & <название>`,
  callback_data: `svc:7d1a7700-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
}]);

function context({ keyboard = '[]', request, credential, input = [{}], params } = {}) {
  return {
    getInputData: () => input,
    getCredentials: async name => {
      assert.equal(name, 'telegramApi');
      return credential ?? { accessToken: token, baseUrl: 'https://untrusted.invalid' };
    },
    getNodeParameter: (name, index, fallback) => {
      const values = params?.[index] ?? { chatId: '12345', text: 'Вы выбрали: &lt;тест&gt; &amp; отчёт', keyboard };
      return Object.hasOwn(values, name) ? values[name] : fallback;
    },
    helpers: { httpRequest: request ?? (async () => ({ ok: true, result: { message_id: 77 } })) },
  };
}

for (const count of [0, 2, 5, 9]) {
  for (const asString of [false, true]) {
    test(`send ${count} buttons, ${asString ? 'JSON string' : 'array'} parameter`, async () => {
      const keyboard = keyboardFor(count);
      let captured;
      const output = await new LdLatteTelegram().execute.call(context({
        keyboard: asString ? JSON.stringify(keyboard) : keyboard,
        request: async options => {
          captured = options;
          return { ok: true, result: { message_id: 77, chat: { id: 12345 }, text: 'not returned' } };
        },
      }));
      assert.equal(captured.url, `https://api.telegram.org/bot${token}/sendMessage`);
      assert.equal(captured.method, 'POST');
      assert.equal(captured.json, true);
      assert.equal(captured.timeout, 20000);
      assert.equal(captured.disableFollowRedirect, true);
      assert.equal(captured.body.chat_id, '12345');
      assert.equal(captured.body.parse_mode, 'HTML');
      assert.equal(captured.body.text, 'Вы выбрали: &lt;тест&gt; &amp; отчёт');
      if (count) assert.deepEqual(captured.body.reply_markup, { inline_keyboard: keyboard });
      else assert.equal(Object.hasOwn(captured.body, 'reply_markup'), false);
      assert.deepEqual(output, [[{ json: { ok: true, message_id: 77 } }]]);
      assert.equal(JSON.stringify(output).includes(token), false);
    });
  }
}

test('node metadata uses the native Telegram credential and main ports', () => {
  const { description } = new LdLatteTelegram();
  assert.equal(description.name, 'ldLatteTelegram');
  assert.equal(description.version, 1);
  assert.deepEqual(description.inputs, ['main']);
  assert.deepEqual(description.outputs, ['main']);
  assert.deepEqual(description.credentials, [{ name: 'telegramApi', required: true }]);
  assert.equal(description.properties.find(p => p.name === 'keyboard').type, 'json');
  assert.equal(description.properties.find(p => p.name === 'keyboard').default, '[]');
});

for (const keyboard of [
  '{', '{}', null, [null], [[]], [[null]], [[{ text: '', callback_data: 'x' }]],
  [[{ text: 'Name', callback_data: '' }]],
  [[{ text: 'Name', callback_data: 'x'.repeat(65) }]],
  [[{ text: 'Name', callback_data: 'я'.repeat(33) }]],
  [[{ text: 'Name', callback_data: 'x', url: 'https://untrusted.invalid' }]],
]) {
  test(`reject invalid keyboard ${JSON.stringify(keyboard)}`, async () => {
    let calls = 0;
    await assert.rejects(new LdLatteTelegram().execute.call(context({ keyboard, request: async () => { calls++; } })), error => {
      assert.equal(String(error).includes(token), false);
      return true;
    });
    assert.equal(calls, 0);
  });
}

test('UTF-8 callback limit accepts exactly 64 bytes', async () => {
  const keyboard = [[{ text: 'Name', callback_data: 'я'.repeat(32) }]];
  await new LdLatteTelegram().execute.call(context({ keyboard }));
});

test('network errors expose neither credential URL nor raw details/cause', async () => {
  await assert.rejects(new LdLatteTelegram().execute.call(context({ request: async () => {
    const error = new Error(`request https://api.telegram.org/bot${token}/sendMessage failed`);
    error.config = { url: `https://api.telegram.org/bot${token}/sendMessage` };
    throw error;
  } })), error => {
    assert.equal(String(error).includes(token), false);
    assert.equal(error.stack.includes(token), false);
    assert.equal(error.message.includes('https://'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    assert.equal(Object.hasOwn(error, 'config'), false);
    return true;
  });
});

test('raw Telegram failure response is not exposed', async () => {
  await assert.rejects(new LdLatteTelegram().execute.call(context({ request: async () => ({ ok: false, description: token }) })), error => !String(error).includes(token));
});

test('malformed credential cannot inject an arbitrary endpoint', async () => {
  let called = false;
  await assert.rejects(new LdLatteTelegram().execute.call(context({
    credential: { accessToken: '123:token/../../another/path' },
    request: async () => { called = true; },
  })));
  assert.equal(called, false);
});

test('multiple items resolve parameters per item and return minimal responses', async () => {
  const ids = [];
  const output = await new LdLatteTelegram().execute.call(context({
    input: [{}, {}],
    params: [
      { chatId: '1', text: 'One', keyboard: [] },
      { chatId: '2', text: 'Two', keyboard: keyboardFor(2) },
    ],
    request: async ({ body }) => {
      ids.push(body.chat_id);
      return { ok: true, result: { message_id: ids.length } };
    },
  }));
  assert.deepEqual(ids, ['1', '2']);
  assert.deepEqual(output, [[{ json: { ok: true, message_id: 1 } }, { json: { ok: true, message_id: 2 } }]]);
});

// Regression coverage: consume actual exported Code and expression bindings.
// The old fake-node test bypassed this boundary and missed rows-expression loss.
const workflow = JSON.parse(await readFile(new URL('../workflow.json', import.meta.url), 'utf8'));
const normalizer = workflow.nodes.find(node => node.name === 'Normalize update');
const builder = workflow.nodes.find(node => node.name === 'Prepare reply');
const sender = workflow.nodes.find(node => node.name === 'Send reply');
const executeCode = (code, globals) => new vm.Script(`(function(){${code}})()`).runInNewContext(globals, { timeout: 1000 });

for (const count of [0, 2, 5, 9]) {
  test(`actual workflow Code -> sender bindings -> custom HTTP, ${count} buttons`, async () => {
    assert.equal(sender.type, 'CUSTOM.ldLatteTelegram');
    assert.equal(sender.typeVersion, 1);
    assert.ok(workflow.connections['Prepare reply'].main[0].some(edge => edge.node === 'Send reply'));
    const update = { message: { chat: { id: 12345, type: 'private' }, text: '/start' } };
    const [event] = executeCode(normalizer.parameters.jsCode, { $input: { first: () => ({ json: update }) } });
    const services = keyboardFor(count).map(([button]) => ({ id: button.callback_data.slice(4), name: button.text }));
    const prepared = executeCode(builder.parameters.jsCode, {
      $: name => {
        assert.equal(name, 'Normalize update');
        return { first: () => event };
      },
      $input: { first: () => ({ json: { services } }) },
    });
    let captured;
    const ctx = context({ request: async options => {
      captured = options;
      return { ok: true, result: { message_id: 900 + count } };
    } });
    ctx.getInputData = () => prepared;
    ctx.getNodeParameter = (name, index, fallback) => {
      const raw = Object.hasOwn(sender.parameters, name) ? sender.parameters[name] : fallback;
      if (typeof raw !== 'string' || !raw.startsWith('={{') || !raw.endsWith('}}')) return raw;
      const expression = raw.slice(3, -2);
      return new vm.Script(`(${expression})`).runInNewContext({ $json: prepared[index].json }, { timeout: 1000 });
    };
    const output = await new LdLatteTelegram().execute.call(ctx);
    assert.equal(captured.body.chat_id, 12345);
    assert.equal(captured.body.parse_mode, 'HTML');
    assert.equal(captured.body.text, count ? 'Выберите услугу:' : 'Сейчас нет доступных услуг. Попробуйте позже.');
    if (count) {
      // VM arrays have another realm's prototype. Compare the actual JSON wire
      // shape used by json:true, not prototype identity across execution realms.
      assert.deepEqual(JSON.parse(JSON.stringify(captured.body.reply_markup.inline_keyboard)), keyboardFor(count));
      assert.equal(captured.body.reply_markup.inline_keyboard.length, count);
    } else assert.equal(Object.hasOwn(captured.body, 'reply_markup'), false);
    assert.deepEqual(output, [[{ json: { ok: true, message_id: 900 + count } }]]);
  });
}
