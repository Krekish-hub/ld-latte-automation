import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeUpdate, prepareReply } from './logic.mjs';

const nodes = [];
function node(name, type, typeVersion, position, parameters, extra = {}) {
  nodes.push({ id: name.toLowerCase().replaceAll(' ', '-'), name, type: `n8n-nodes-base.${type}`, typeVersion, position, parameters, ...extra });
}
function booleanCondition(expression) {
  return { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'condition', leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} };
}
node('Telegram updates', 'telegramTrigger', 1.2, [0, 240], { updates: ['message', 'callback_query'], additionalFields: {} }, { webhookId: 'e084eddb-efb9-4600-b8a9-3d682b813365' });
node('Normalize update', 'code', 2, [240, 240], { jsCode: `${normalizeUpdate.toString()}\nreturn [{ json: normalizeUpdate($input.first().json) }];` });
node('Private chat', 'if', 2.2, [480, 240], booleanCondition('={{ $json.chatId !== null }}'));
node('Has callback', 'if', 2.2, [720, 160], booleanCondition('={{ Boolean($json.queryId) }}'));
node('Answer callback', 'telegram', 1.2, [960, 0], { resource: 'callback', operation: 'answerQuery', queryId: "={{ $('Normalize update').first().json.queryId }}", additionalFields: {} }, { onError: 'continueRegularOutput' });
node('Restore event', 'code', 2, [1200, 0], { jsCode: "return [{ json: $('Normalize update').first().json }];" });
node('Read required', 'if', 2.2, [1440, 160], booleanCondition("={{ ['start', 'selection'].includes($('Normalize update').first().json.kind) }}"));
node('Read active services', 'postgres', 2.6, [1680, 80], { operation: 'executeQuery', query: `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order, id), '[]'::jsonb) as services
from public.services
where active = true and ($1::uuid is null or id = $1::uuid);`, options: { queryReplacement: "={{ [ $('Normalize update').first().json.serviceId ] }}" } }, { onError: 'continueRegularOutput' });
node('Prepare reply', 'code', 2, [1920, 160], { jsCode: `${prepareReply.toString()}\nreturn [{ json: prepareReply($('Normalize update').first().json, $input.first().json) }];` });
node('Send reply', 'telegram', 1.2, [2160, 160], { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chatId }}', text: '={{ $json.text }}', replyMarkup: "={{ $json.hasButtons ? 'inlineKeyboard' : 'none' }}", inlineKeyboard: { rows: '={{ $json.rows }}' }, additionalFields: { appendAttribution: false, parse_mode: 'HTML' } });
const connections = {};
function connect(from, targets) {
  connections[from] = { main: targets.map(names => names.map(node => ({ node, type: 'main', index: 0 }))) };
}
connect('Telegram updates', [['Normalize update']]);
connect('Normalize update', [['Private chat']]);
connect('Private chat', [['Has callback'], []]);
connect('Has callback', [['Answer callback'], ['Read required']]);
connect('Answer callback', [['Restore event']]);
connect('Restore event', [['Read required']]);
connect('Read required', [['Read active services'], ['Prepare reply']]);
connect('Read active services', [['Prepare reply']]);
connect('Prepare reply', [['Send reply']]);
const workflow = { name: 'LD LATTE - dynamic service menu', nodes, connections, active: false, settings: { executionOrder: 'v1', timezone: 'Asia/Chita', executionTimeout: 60, saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all', saveManualExecutions: false }, pinData: {}, tags: [] };
const path = fileURLToPath(new URL('./workflow.json', import.meta.url));
await writeFile(path, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Generated ${nodes.length} nodes, no credentials or tokens.`);
