import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatCompletion } from '../shared/llm.js';
import { kbSearch } from '../shared/kb.js';
import { audit } from '../shared/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const promptPath = path.resolve(here, '../../prompts/marketing.md');
const rubricsPath = path.resolve(here, '../../marketing/rubrics.md');

export async function createMarketingDraft({ topic, channel = 'Telegram', rubric = null, sourceUrl = null }) {
  const [prompt, rubrics] = await Promise.all([
    fs.readFile(promptPath, 'utf8'),
    fs.readFile(rubricsPath, 'utf8')
  ]);
  const docs = await kbSearch(topic, 5);
  const kbContext = docs.map(doc => `# ${doc.file}\n${doc.text}`).join('\n\n');

  const userMessage = [
    `Канал: ${channel}`,
    rubric ? `Рубрика: ${rubric}` : '',
    `Тема: ${topic}`,
    sourceUrl ? `Источник: ${sourceUrl}` : '',
    'Подготовь только черновик для согласования. Не публикуй.'
  ].filter(Boolean).join('\n');

  const draft = await chatCompletion({
    system: `${prompt}\n\nРУБРИКИ:\n${rubrics}\n\nПОДТВЕРЖДЁННЫЕ ФАКТЫ ИЗ БАЗЫ:\n${kbContext || 'Нет релевантных фактов. Не придумывай их.'}`,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.5
  });

  await audit('marketing_draft_created', { channel, rubric, kb: docs.map(d => d.file), sourceUrl: sourceUrl || null });
  return { draft, status: 'pending_approval', kb: docs.map(d => d.file) };
}