// The single source of truth for the database schema. Every statement is
// idempotent, so applying it more than once is safe.
//
// Applied either by `npm run db:init` (needs DATABASE_URL locally) or by the
// deployed site itself at /api/init, which already has the connection string.

export const SCHEMA_STATEMENTS = [
  `create extension if not exists "pgcrypto"`,

  `create table if not exists users (
     id             uuid primary key default gen_random_uuid(),
     username       text not null,
     username_lower text not null unique,
     password_hash  text not null,
     avatar_style   text not null default 'grid',
     avatar_seed    text not null,
     color_index    int  not null default 0,
     created_at     timestamptz not null default now()
   )`,

  `create table if not exists sessions (
     token      text primary key,
     user_id    uuid not null references users(id) on delete cascade,
     created_at timestamptz not null default now(),
     expires_at timestamptz not null
   )`,
  `create index if not exists sessions_user_idx on sessions(user_id)`,
  `create index if not exists sessions_expires_idx on sessions(expires_at)`,

  // One row per contiguous free block. start_slot inclusive, end_slot
  // exclusive, both in 30-minute units from local midnight (0..48).
  `create table if not exists availability (
     id         bigserial primary key,
     user_id    uuid not null references users(id) on delete cascade,
     day        date not null,
     start_slot int  not null check (start_slot >= 0 and start_slot < 48),
     end_slot   int  not null check (end_slot > 0 and end_slot <= 48),
     note       text,
     created_at timestamptz not null default now(),
     check (end_slot > start_slot)
   )`,
  // For databases created before notes existed.
  `alter table availability add column if not exists note text`,
  `create index if not exists availability_day_idx on availability(day)`,
  `create index if not exists availability_user_day_idx on availability(user_id, day)`,

  // Throttles brute-force guessing of the invite code.
  `create table if not exists invite_attempts (
     id  bigserial primary key,
     ip  text not null,
     ok  boolean not null,
     at  timestamptz not null default now()
   )`,
  `create index if not exists invite_attempts_ip_at_idx on invite_attempts(ip, at)`,
];

/** The whole schema as one script, for pasting into a SQL console. */
export function schemaSql() {
  return SCHEMA_STATEMENTS.map((s) => `${s};`).join("\n\n") + "\n";
}
