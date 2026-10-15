import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatCompletion } from '../shared/llm.js';
import { maskPersonalData } from '../shared/pii.js';
import { kbSearch } from '../shared/kb.js';
import { audit } from '../shared/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const promptPath = path.resolve(here, '../../prompts/frontoffice.md');

export function estimateSavings({ people, hoursPerDay, hourlyRate, share }) {
  const monthlyHours = Number(people) * Number(hoursPerDay) * 21;
  const currentCost = monthlyHours * Number(hourlyRate);
  const savings = currentCost * Number(share);
  return {
    monthlyHours,
    currentCost: Math.round(currentCost),
    savings: Math.round(savings),
    freedHours: Math.round(monthlyHours * Number(share))
  };
}

export async function answerFrontOffice({ message, history = [] }) {
  const docs = await kbSearch(message);
  const kbContext = docs.map(doc => `# ${doc.file}\n${doc.text}`).join('\n\n');
  const systemBase = await fs.readFile(promptPath, 'utf8');
  const { text: maskedMessage } = maskPersonalData(message);
  const maskedHistory = history.slice(-8).map(item => ({
    role: item.role,
    content: maskPersonalData(item.content).text
  }));

  if (!docs.length) {
    await audit('frontoffice_handoff_no_kb', { reason: 'no_kb_match' });
    return {
      reply: 'По этому вопросу у меня нет подтверждённой информации в базе знаний. Передам вопрос команде, чтобы не придумывать ответ.',
      handoff: true
    };
  }

  try {
    const reply = await chatCompletion({
      system: `${systemBase}\n\nБАЗА ЗНАНИЙ ДЛЯ ЭТОГО ОТВЕТА:\n${kbContext}`,
      messages: [...maskedHistory, { role: 'user', content: maskedMessage }]
    });
    await audit('frontoffice_answer', { kb: docs.map(d => d.file) });
    return { reply, handoff: false, kb: docs.map(d => d.file) };
  } catch (error) {
    await audit('frontoffice_degraded', { error: String(error.message || error) });
    return {
      reply: 'Заявка принята. Сейчас автоматический ассистент временно недоступен — команда ответит в течение рабочего дня.',
      handoff: true,
      degraded: true
    };
  }
}