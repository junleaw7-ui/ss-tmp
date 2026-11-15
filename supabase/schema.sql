create extension if not exists pgcrypto;

drop table if exists households;
drop table if exists roll_calls;

create table households (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- 6 chars, e.g. 'K7Q2MX' (no 0/O/1/I)
  label text not null,                    -- 'No. 12, Kg Manjor'
  kampung text not null,
  head_name text not null,                -- first name only
  members int not null default 1,
  tags text[] not null default '{}',      -- elderly | oku | baby | pregnant | chronic
  risk_zone text not null default 'medium', -- high | medium | low
  phone_masked text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending', -- pending | safe | help | dispatched | rescued
  message text,
  triage jsonb,                           -- { urgency, need, people, summary_en, source: 'ai'|'rules' }
  replied_at timestamptz,
  source text not null default 'self',    -- self | buddy
  buddy_note text,                        -- set by "Buddy: cannot reach"
  scheduled_reply_at timestamptz,         -- set by /api/simulate
  scheduled_status text,                  -- safe | help
  scheduled_message text,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now()
);

create table roll_calls (
  id uuid primary key default gen_random_uuid(),
  area text not null default 'Kuala Krai',
  started_at timestamptz not null default now(),
  deadline_minutes int not null default 2,   -- 1 | 2 | 15 | 30
  ended_at timestamptz
);

create index on households (is_demo);
create index on households (scheduled_reply_at) where scheduled_reply_at is not null;
create unique index only_one_active_rollcall on roll_calls ((true)) where ended_at is null;

-- Applies simulated replies whose time has come. One atomic UPDATE, so overlapping polls cannot apply a reply twice.
-- Needed because the Supabase JS client cannot copy one column into another in an update.
create or replace function apply_due_replies()
returns table (id uuid, status text, message text)
language sql
as $$
  update households h
  set status = h.scheduled_status,
      message = h.scheduled_message,
      replied_at = h.scheduled_reply_at,
      source = 'self',
      scheduled_reply_at = null,
      scheduled_status = null,
      scheduled_message = null,
      updated_at = now()
  where h.scheduled_reply_at is not null and h.scheduled_reply_at <= now()
  returning h.id, h.status, h.message;
$$;
