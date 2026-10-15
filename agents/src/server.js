import 'dotenv/config';
import express from 'express';
import { saveLead, audit } from './shared/db.js';
import { answerFrontOffice, estimateSavings } from './frontoffice/agent.js';
import { createMarketingDraft } from './marketing/agent.js';

const app = express();
const port = Number(process.env.PORT || 8788);

app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('access-control-allow-origin', process.env.SITE_ORIGIN || 'https://triprobots.ru');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, service: 'triprobots-agents' }));

app.post('/api/lead', async (req, res) => {
  try {
    const { name, contact, company, area, message, source = 'site', meta = {} } = req.body || {};
    if (!contact || !message) return res.status(400).json({ ok: false, error: 'contact_and_message_required' });

    const lead = await saveLead({ name, contact, company, area, message, source, meta });
    await audit('lead_received', { leadId: lead.id, source });

    const agent = await answerFrontOffice({ message, history: [] });
    return res.json({
      ok: true,
      leadId: lead.id,
      persisted: lead.persisted,
      reply: agent.reply,
      handoff: agent.handoff
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      reply: 'Заявка принята не полностью. Пожалуйста, продублируйте её в Telegram или на почту компании.'
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    if (!message) return res.status(400).json({ ok: false, error: 'message_required' });
    const result = await answerFrontOffice({ message, history });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'agent_failed' });
  }
});

app.post('/api/estimate', (req, res) => {
  const { people, hoursPerDay, hourlyRate, share } = req.body || {};
  const nums = [people, hoursPerDay, hourlyRate, share].map(Number);
  if (nums.some(n => !Number.isFinite(n) || n < 0)) return res.status(400).json({ ok: false, error: 'invalid_numbers' });
  res.json({ ok: true, ...estimateSavings({ people, hoursPerDay, hourlyRate, share }) });
});

app.post('/api/marketing/draft', async (req, res) => {
  try {
    const { topic, channel, rubric, sourceUrl } = req.body || {};
    if (!topic) return res.status(400).json({ ok: false, error: 'topic_required' });
    const result = await createMarketingDraft({ topic, channel, rubric, sourceUrl });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'draft_failed' });
  }
});

app.listen(port, () => console.log(`TRIPROBOTS agents listening on :${port}`));