import 'dotenv/config';
import express from 'express';
import { answerFrontOffice, estimateSavings } from './frontoffice/agent.js';
import { createMarketingDraft } from './marketing/agent.js';

const app = express();
const port = Number(process.env.PORT || 8788);
const siteOrigin = process.env.SITE_ORIGIN || 'https://triprobots.ru';
const hits = new Map();
const maxPerMinute = Number(process.env.MAX_MESSAGES_PER_MINUTE || 12);

app.set('trust proxy', 1);
app.use(express.json({ limit: '128kb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin !== siteOrigin) return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  res.setHeader('access-control-allow-origin', siteOrigin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-headers', 'content-type,x-internal-key,x-admin-key');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const now = Date.now();
  const key = req.ip || 'unknown';
  const recent = (hits.get(key) || []).filter(ts => ts > now - 60_000);
  if (recent.length >= maxPerMinute) return res.status(429).json({ ok: false, error: 'rate_limited' });
  recent.push(now);
  hits.set(key, recent);
  next();
});

function requireInternal(req, res, next) {
  const expected = process.env.AGENT_INTERNAL_KEY;
  if (!expected || req.get('x-internal-key') !== expected) return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}

function requireAdmin(req, res, next) {
  const expected = process.env.MARKETING_ADMIN_KEY;
  if (!expected || req.get('x-admin-key') !== expected) return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Only the Russia ingress service may send front-office text here.
// Payload must already be anonymized; this service never stores raw personal data.
app.post('/internal/frontoffice', requireInternal, async (req, res) => {
  try {
    const { message, history = [], leadRef = null, source = 'unknown' } = req.body || {};
    if (!message) return res.status(400).json({ ok: false, error: 'message_required' });
    const result = await answerFrontOffice({ message, history });
    res.json({ ok: true, leadRef, source, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'agent_failed' });
  }
});

// Public calculator endpoint: no personal data is required.
app.post('/api/estimate', (req, res) => {
  const { people, hoursPerDay, hourlyRate, share } = req.body || {};
  const nums = [people, hoursPerDay, hourlyRate, share].map(Number);
  if (nums.some(n => !Number.isFinite(n) || n < 0)) return res.status(400).json({ ok: false, error: 'invalid_numbers' });
  res.json({ ok: true, ...estimateSavings({ people, hoursPerDay, hourlyRate, share }) });
});

// Marketing generation is not public. Publishing remains a separate approval step.
app.post('/api/marketing/draft', requireAdmin, async (req, res) => {
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
