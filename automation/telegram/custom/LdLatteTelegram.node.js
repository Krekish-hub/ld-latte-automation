'use strict';

// Private node: native encrypted telegramApi credentials, no environment tokens.
// Only callback buttons are supported; URL/login/web-app buttons are forbidden.
function validatedKeyboard(value) {
  const rows = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(rows)) throw new Error('Invalid keyboard');
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length === 0) throw new Error('Invalid row');
    return row.map((button) => {
      if (!button || typeof button !== 'object' || Array.isArray(button)
        || Object.keys(button).some((key) => key !== 'text' && key !== 'callback_data')
        || typeof button.text !== 'string' || !button.text.trim()
        || typeof button.callback_data !== 'string'
        || Buffer.byteLength(button.callback_data, 'utf8') < 1
        || Buffer.byteLength(button.callback_data, 'utf8') > 64) {
        throw new Error('Invalid callback button');
      }
      // Copy only supported fields. Do not forward arbitrary user properties.
      return { text: button.text, callback_data: button.callback_data };
    });
  });
}

class LdLatteTelegram {
  constructor() {
    this.description = {
      displayName: 'LD LATTE Telegram',
      name: 'ldLatteTelegram',
      group: ['output'],
      version: 1,
      description: 'Send HTML messages with a dynamic callback-only keyboard',
      defaults: { name: 'LD LATTE Telegram' },
      inputs: ['main'],
      outputs: ['main'],
      credentials: [{ name: 'telegramApi', required: true }],
      properties: [
        { displayName: 'Chat ID', name: 'chatId', type: 'string', default: '', required: true },
        { displayName: 'Text (HTML)', name: 'text', type: 'string', typeOptions: { rows: 4 }, default: '', required: true },
        { displayName: 'Inline Keyboard', name: 'keyboard', type: 'json', default: '[]', description: 'Array of rows of {text, callback_data}; [] sends no keyboard' },
      ],
    };
  }

  async execute() {
    try {
      const credentials = await this.getCredentials('telegramApi');
      const token = credentials.accessToken;
      // Prevent a malformed credential from changing the fixed URL path/host.
      if (typeof token !== 'string' || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
        throw new Error('Invalid credential');
      }
      const output = [];
      const items = this.getInputData();
      for (let index = 0; index < items.length; index += 1) {
        const chatId = this.getNodeParameter('chatId', index);
        const text = this.getNodeParameter('text', index);
        const keyboard = validatedKeyboard(this.getNodeParameter('keyboard', index, '[]'));
        if ((typeof chatId !== 'string' && typeof chatId !== 'number')
          || !/^-?\d+$/.test(String(chatId))
          || (typeof chatId === 'number' && !Number.isSafeInteger(chatId))
          || typeof text !== 'string' || !text.trim()) {
          throw new Error('Invalid message');
        }
        const body = { chat_id: chatId, text, parse_mode: 'HTML' };
        if (keyboard.length) body.reply_markup = { inline_keyboard: keyboard };
        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: `https://api.telegram.org/bot${token}/sendMessage`,
          body,
          json: true,
          timeout: 20000,
          disableFollowRedirect: true,
        });
        if (response?.ok !== true || !Number.isSafeInteger(response?.result?.message_id)
          || response.result.message_id <= 0) {
          throw new Error('Invalid Telegram response');
        }
        output.push({ json: { ok: true, message_id: response.result.message_id } });
      }
      return [output];
    } catch {
      // Never propagate HTTP errors/cause: they can include the token-bearing URL,
      // request body, credentials, Axios config, or a raw Telegram response.
      throw new Error('Не удалось отправить сообщение Telegram. Проверьте параметры, credentials и соединение.');
    }
  }
}

module.exports = { LdLatteTelegram };
