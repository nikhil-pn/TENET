-- TENET cloud schema — Supabase (Postgres) + Row-Level Security.
--
-- Design notes:
--  * Each table is owned per-user via `user_id uuid references auth.users`.
--    RLS restricts every row to its owner (auth.uid() = user_id), so the
--    public anon key is safe to ship in the client — the DB enforces access.
--  * Timestamps from the app are epoch-millis (bigint) to match lib/types.ts
--    (the `Timestamp` type). Each syncable row ALSO carries `updated_at`
--    (timestamptz, server clock) — the field the sync layer's last-write-wins
--    merge compares. day_logs/profiles key on a natural id; the rest use the
--    client-generated record id, so upserts are idempotent across devices.
--  * pomodoro_sessions is the IMMUTABLE accountability ledger: it has only
--    SELECT + INSERT policies, so neither UPDATE nor DELETE is possible —
--    not even for the owner. That is the tamper-proof focus record. (The
--    GitHub contribution graph rides on top as public motivation; commits can
--    technically be backdated, so the DB ledger — not the graph — is truth.)

-- ─────────────────────────────── todos ──────────────────────────────────────
create table if not exists public.todos (
  user_id           uuid    not null references auth.users on delete cascade,
  id                text    not null,                 -- client-generated record id
  title             text    not null,
  done              boolean not null default false,
  created_at        bigint  not null,                 -- epoch ms
  completed_at      bigint,
  order_pos         integer not null default 0,       -- `order` is reserved in SQL
  date              text,                              -- planner day "YYYY-MM-DD"
  due_at            bigint,
  deadline          text,                              -- hard deadline "YYYY-MM-DD"
  important         boolean,
  urgent            boolean,
  estimated_minutes integer,
  delegated         boolean,
  dropped           boolean,
  pomodoro_count    integer,
  actual_minutes    integer,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

-- ─────────────────────────────── habits ─────────────────────────────────────
create table if not exists public.habits (
  user_id        uuid    not null references auth.users on delete cascade,
  id             text    not null,
  name           text    not null,
  emoji          text,
  created_at     bigint  not null,
  order_pos      integer not null default 0,
  checkins       jsonb   not null default '{}'::jsonb, -- { "YYYY-MM-DD": count }
  target_per_day integer,
  archived       boolean,
  updated_at     timestamptz not null default now(),
  primary key (user_id, id)
);

-- ────────────────────────────── day_logs ────────────────────────────────────
-- One per calendar day; the date IS the natural key (no separate id locally).
create table if not exists public.day_logs (
  user_id            uuid    not null references auth.users on delete cascade,
  date               text    not null,                -- "YYYY-MM-DD"
  satisfaction_score integer not null,
  satisfaction_note  text,
  logged_at          bigint  not null,
  updated_at         timestamptz not null default now(),
  primary key (user_id, date)
);

-- ─────────────────────────────── notes ──────────────────────────────────────
-- Day reminders, monthly reminders, and freeform custom notes. `kind` is a
-- plain text check (not an enum) so future note types need no migration.
create table if not exists public.notes (
  user_id    uuid    not null references auth.users on delete cascade,
  id         text    not null,
  kind       text    not null default 'custom'
             check (kind in ('daily', 'monthly', 'custom')),
  date       text,                                    -- day for 'daily', "YYYY-MM" for 'monthly'
  title      text    not null default '',
  body       text    not null default '',
  created_at bigint  not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ──────────────────────── pomodoro_sessions (immutable) ──────────────────────
create table if not exists public.pomodoro_sessions (
  id               uuid    not null default gen_random_uuid(),
  user_id          uuid    not null references auth.users on delete cascade,
  task_id          text,                              -- nullable Pomodoro↔task link
  started_at       bigint  not null,                  -- epoch ms
  ended_at         bigint  not null,
  duration_minutes integer not null,
  date             text    not null,                  -- "YYYY-MM-DD" (local day)
  created_at       timestamptz not null default now(),
  primary key (id)
);

-- ────────────────────────────── profiles ────────────────────────────────────
create table if not exists public.profiles (
  id              uuid    not null references auth.users on delete cascade,
  github_username text,
  streak_repo     text    not null default 'tenet-log',
  streak_enabled  boolean not null default true,
  updated_at      timestamptz not null default now(),
  primary key (id)
);

-- ─────────────────────────── Row-Level Security ─────────────────────────────
alter table public.todos             enable row level security;
alter table public.habits            enable row level security;
alter table public.day_logs          enable row level security;
alter table public.notes             enable row level security;
alter table public.pomodoro_sessions enable row level security;
alter table public.profiles          enable row level security;

-- Full owner CRUD for the mutable tables. (FOR ALL = select/insert/update/delete.)
create policy "todos owner"    on public.todos    for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits owner"   on public.habits   for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "day_logs owner" on public.day_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes owner"    on public.notes    for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles: owner CRUD, keyed on id (= auth.uid()).
create policy "profiles owner" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- pomodoro_sessions: SELECT + INSERT only. The deliberate ABSENCE of UPDATE and
-- DELETE policies makes the ledger append-only under RLS — this is the feature.
create policy "sessions read"   on public.pomodoro_sessions for select
  using (auth.uid() = user_id);
create policy "sessions insert" on public.pomodoro_sessions for insert
  with check (auth.uid() = user_id);

-- Auto-create a profile row the first time a user signs in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, github_username)
  values (new.id, new.raw_user_meta_data ->> 'user_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
