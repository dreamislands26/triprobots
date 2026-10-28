import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import { createTrialHandler } from './trial.js';
import { maskPersonalData, restorePersonalData } from './pii.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8787);
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const siteOrigin = process.env.SITE_ORIGIN || 'https://triprobots.ru';
const logicUrl = (process.env.AGENT_LOGIC_URL || '').replace(/\/$/, '');
const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS || 6000);
const maxPerMinute = Number(process.env.MAX_REQUESTS_PER_MINUTE || 12);
const honeypotField = process.env.HONEYPOT_FIELD || 'website';
const hits = new Map();

app.set('trust proxy', 1);
app.use('/api/trial', express.json({ limit: '8mb' }));
app.use(express.json({ limit: '128kb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin !== siteOrigin) return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  res.setHeader('access-control-allow-origin', siteOrigin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const now = Date.now();
  const key = req.ip || 'unknown';
  const windowStart = now - 60_000;
  const recent = (hits.get(key) || []).filter(ts => ts > windowStart);
  if (recent.length >= maxPerMinute) return res.status(429).json({ ok: false, error: 'rate_limited' });
  recent.push(now);
  hits.set(key, recent);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function saveRawLead({ name = null, contact = null, company = null, area = null, message = null, source = 'site', meta = {} }) {
  const result = await db.query(
    `insert into leads(name, contact, company, area, message, source, meta)
     values($1,$2,$3,$4,$5,$6,$7::jsonb)
     returning id`,
    [name, contact, company, area, message, source, JSON.stringify(meta)]
  );
  return result.rows[0].id;
}

async function callLogic(payload) {
  if (!logicUrl || !process.env.AGENT_INTERNAL_KEY) throw new Error('logic_not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${logicUrl}/internal/frontoffice`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': process.env.AGENT_INTERNAL_KEY
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`logic_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/lead', async (req, res) => {
  const body = req.body || {};
  if (body[honeypotField]) return res.status(200).json({ ok: true });

  const { name, contact, company, area, message, source = 'site', meta = {} } = body;
  if (!contact || !message) return res.status(400).json({ ok: false, error: 'contact_and_message_required' });

  try {
    const leadId = await saveRawLead({ name, contact, company, area, message, source, meta });

    const composite = [
      `Имя: ${name || 'не указано'}`,
      `Контакт: ${contact}`,
      `Компания: ${company || 'не указана'}`,
      `Направление: ${area || 'не указано'}`,
      `Сообщение: ${message}`
    ].join('\n');
    const masked = maskPersonalData(composite);

    try {
      const result = await callLogic({ leadRef: leadId, source, message: masked.text });
      const reply = restorePersonalData(result.reply || '', masked.replacements);
      return res.json({ ok: true, accepted: true, leadId, reply, handoff: Boolean(result.handoff) });
    } catch (logicError) {
      console.error('logic unavailable', logicError.message);
      return res.status(202).json({
        ok: true,
        accepted: true,
        leadId,
        degraded: true,
        reply: 'Заявка принята. Ответим в течение рабочего дня.'
      });
    }
  } catch (error) {
    console.error('ingress failed', error);
    return res.status(500).json({ ok: false, accepted: false, error: 'ingress_failed' });
  }
});

app.post('/telegram/webhook', async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) return res.sendStatus(403);

  const update = req.body || {};
  const msg = update.message;
  if (!msg?.chat?.id || !msg.text) return res.sendStatus(200);

  const rawText = msg.text;
  const contact = msg.from?.username ? `@${msg.from.username}` : `telegram:${msg.from?.id || msg.chat.id}`;

  try {
    const leadId = await saveRawLead({
      name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || null,
      contact,
      message: rawText,
      source: 'telegram',
      meta: { chatId: String(msg.chat.id) }
    });

    const masked = maskPersonalData(`Контакт: ${contact}\nСообщение: ${rawText}`);
    let reply = 'Заявка принята. Ответим в течение рабочего дня.';
    try {
      const result = await callLogic({ leadRef: leadId, source: 'telegram', message: masked.text });
      reply = restorePersonalData(result.reply || reply, masked.replacements);
    } catch (error) {
      console.error('telegram logic unavailable', error.message);
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: msg.chat.id, text: reply })
      });
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('telegram ingress failed', error);
    return res.sendStatus(200);
  }
});

const trialConfigured = process.env.TRIAL_ENABLED === 'true' && process.env.DATA_REGION === 'RU' && Boolean(process.env.DATABASE_URL && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
let trialTransport;
if (trialConfigured) {
  const { default: nodemailer } = await import('nodemailer');
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  trialTransport = nodemailer.createTransport({host:process.env.SMTP_HOST,port:smtpPort,secure:smtpPort===465,requireTLS:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
}
app.post('/api/trial',createTrialHandler({db,configured:trialConfigured,from:process.env.SMTP_FROM,sendMail:message=>trialTransport.sendMail(message)}));
app.use((error,req,res,next)=>{
  if(req.path==='/api/trial')return res.status(error.type==='entity.too.large'?413:400).json({ok:false,error:'invalid_submission'});
  next(error);
});

app.listen(port, () => console.log(`TRIPROBOTS ingress listening on :${port}`));
