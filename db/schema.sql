create extension if not exists "pgcrypto";

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  username_lower text not null unique,
  password_hash  text not null,
  avatar_style   text not null default 'notionists',
  avatar_seed    text not null,
  color_index    int  not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists sessions (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

-- One row per contiguous free block. start_slot inclusive, end_slot exclusive,
-- both in 30-minute units from local midnight (0..48).
create table if not exists availability (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  start_slot int  not null check (start_slot >= 0 and start_slot < 48),
  end_slot   int  not null check (end_slot > 0 and end_slot <= 48),
  created_at timestamptz not null default now(),
  check (end_slot > start_slot)
);
create index if not exists availability_day_idx on availability(day);
create index if not exists availability_user_day_idx on availability(user_id, day);

-- Throttles brute-force guessing of the invite code.
create table if not exists invite_attempts (
  id  bigserial primary key,
  ip  text not null,
  ok  boolean not null,
  at  timestamptz not null default now()
);
create index if not exists invite_attempts_ip_at_idx on invite_attempts(ip, at);
