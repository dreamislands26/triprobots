-- Run only on the PostgreSQL instance physically hosted in Russia.
create table if not exists trial_submissions (
 request_id uuid primary key,
 created_at timestamptz not null default now(),
 name text not null,
 contact text not null,
 company text not null default '',
 area text not null default '',
 message text not null default '',
 solution text not null default '',
 calculation text not null default '',
 file_name text,
 file_content bytea,
 email_status text not null default 'pending' check(email_status in ('pending','failed','sent')),
 email_sent_at timestamptz,
 email_message_id text,
 check(file_content is null or octet_length(file_content)<=5242880)
);
