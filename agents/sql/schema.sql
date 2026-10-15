create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text,
  contact text,
  company text,
  area text,
  message text,
  source text not null default 'site',
  status text not null default 'new',
  meta jsonb not null default '{}'::jsonb
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  channel text not null,
  external_id text,
  lead_id uuid references leads(id),
  state jsonb not null default '{}'::jsonb
);

create table if not exists audit_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  action text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists marketing_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  channel text not null,
  rubric text,
  title text,
  body text not null,
  cta text,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
);