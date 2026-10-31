// Pure functions embedded verbatim into n8n Code nodes by build-workflow.mjs.
export function normalizeUpdate(update) {
  const callback = update?.callback_query;
  const message = callback?.message ?? update?.message;
  const chat = message?.chat;
  if (chat?.type !== 'private' || !Number.isSafeInteger(chat.id)) return { kind: 'ignore', chatId: null, queryId: '', serviceId: null };
  const common = { chatId: chat.id, queryId: '', serviceId: null };
  if (callback) {
    if (typeof callback.id !== 'string' || !callback.id) return { ...common, kind: 'ignore', chatId: null };
    common.queryId = callback.id;
    const match = /^svc:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(callback.data ?? '');
    if (!match) return { ...common, kind: 'hint', text: 'Эта кнопка устарела. Отправьте /start, чтобы открыть меню.' };
    return { ...common, kind: 'selection', serviceId: match[1].toLowerCase() };
  }
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (/^\/start(?:@ZmeiiniyBot)?(?:\s+.*)?$/i.test(text)) return { ...common, kind: 'start' };
  return { ...common, kind: 'hint', text: 'Чтобы выбрать услугу, отправьте /start.' };
}

export function prepareReply(event, queryResult) {
  const reply = { chatId: event.chatId, text: event.text ?? '', rows: [], hasButtons: false };
  if (event.kind === 'hint' || event.kind === 'ignore') return reply;
  let services = queryResult?.services;
  if (typeof services === 'string') { try { services = JSON.parse(services); } catch { services = null; } }
  const valid = Array.isArray(services) && services.every(s => s && typeof s.name === 'string' && s.name.trim() && typeof s.id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s.id));
  if (queryResult?.error || !valid) return { ...reply, text: 'Не удалось загрузить услуги. Попробуйте ещё раз немного позже.' };
  if (event.kind === 'selection') return { ...reply, text: services.length ? `Вы выбрали: ${services[0].name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}` : 'Услуга больше недоступна. Отправьте /start, чтобы обновить меню.' };
  if (!services.length) return { ...reply, text: 'Сейчас нет доступных услуг. Попробуйте позже.' };
  return {
    ...reply, text: 'Выберите услугу:', hasButtons: true,
    rows: services.map(service => [{ text: service.name, callback_data: `svc:${service.id}` }]),
  };
}
