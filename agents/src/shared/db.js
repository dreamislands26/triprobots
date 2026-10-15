import pg from 'pg';

const { Pool } = pg;
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function saveLead({ name = null, contact = null, company = null, area = null, message = null, source = 'site', meta = {} }) {
  const db = getPool();
  if (!db) return { id: null, persisted: false };
  const result = await db.query(
    `insert into leads(name, contact, company, area, message, source, meta)
     values($1,$2,$3,$4,$5,$6,$7::jsonb)
     returning id`,
    [name, contact, company, area, message, source, JSON.stringify(meta)]
  );
  return { id: result.rows[0].id, persisted: true };
}

export async function audit(action, payload = {}) {
  const db = getPool();
  if (!db) return;
  await db.query(
    `insert into audit_log(action, payload) values($1,$2::jsonb)`,
    [action, JSON.stringify(payload)]
  );
}