-- ============================================================
--  BodyLens — Complete Database Schema
--  Run this in the Supabase SQL Editor to bring the database
--  to its full intended state.
--
--  Uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS throughout
--  so it is safe to run against an existing database.
--  Nothing is dropped or overwritten.
-- ============================================================


-- ── 1. PROFILES ─────────────────────────────────────────────
-- One row per user. The profile JSONB column holds the entire
-- user object: name, age, weight, goal, macros, weekPlan,
-- supplements, training schedule, and all programme data.
-- Additional typed columns hold data categories that need
-- to be queried or restored independently.

create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  name         text,
  profile      jsonb,              -- full profile object
  scan_history jsonb,              -- body scan results history
  coach_history jsonb,             -- AI coaching conversation history
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Add columns that may not exist yet
alter table profiles add column if not exists strength_baseline  jsonb;   -- 1RM benchmarks and performance data
alter table profiles add column if not exists latest_report      jsonb;   -- most recent generated coaching report
alter table profiles add column if not exists podcast_history    jsonb;   -- podcast episode listening history
alter table profiles add column if not exists fridge_data        jsonb;   -- fridge / restock state
alter table profiles add column if not exists shop_data          jsonb;   -- shopping checklist state
alter table profiles add column if not exists decision_log       jsonb;   -- decision log (proposals, manual entries, reversions)

alter table profiles enable row level security;

drop policy if exists "Users own profile" on profiles;
create policy "Users own profile" on profiles
  for all using (auth.uid() = id);


-- ── 2. DAY LOGS ─────────────────────────────────────────────
-- One row per user per calendar day.
-- The data JSONB column holds everything logged that day:
-- trainStatus, exercises (weight/sets per exercise), meals
-- (protein logged per slot), suppLog (which supplements taken),
-- energy rating, cardioLogged, notes, debrief conversation.

create table if not exists day_logs (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  date       date not null,
  data       jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table day_logs enable row level security;

drop policy if exists "Users own day_logs" on day_logs;
create policy "Users own day_logs" on day_logs
  for all using (auth.uid() = user_id);


-- ── 3. MACROS ───────────────────────────────────────────────
-- One row per user per calendar day.
-- The data JSONB column holds: target (kcal, protein, carbs,
-- fat) and eaten (running totals updated as meals are logged).

create table if not exists macros (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  date       date not null,
  data       jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table macros enable row level security;

drop policy if exists "Users own macros" on macros;
create policy "Users own macros" on macros
  for all using (auth.uid() = user_id);


-- ── 4. MEAL PLANS ───────────────────────────────────────────
-- One row per user per week (keyed by week start date).
-- Stores the AI-generated weekly meal plan: 7 days of meals
-- with names, calories, macros per slot.

create table if not exists meal_plans (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  week_start date not null,
  data       jsonb,
  updated_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table meal_plans enable row level security;

drop policy if exists "Users own meal_plans" on meal_plans;
create policy "Users own meal_plans" on meal_plans
  for all using (auth.uid() = user_id);


-- ── 5. WEEK LEDGER ──────────────────────────────────────────
-- One row per user per week.
-- Stores the training week view data: planned vs actual
-- sessions, fatigue score, week status, coach read.

create table if not exists week_ledger (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  week_start date not null,
  data       jsonb,
  updated_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table week_ledger enable row level security;

drop policy if exists "Users own week_ledger" on week_ledger;
create policy "Users own week_ledger" on week_ledger
  for all using (auth.uid() = user_id);


-- ── 6. ACTIVITIES ───────────────────────────────────────────
-- One row per user per calendar day.
-- Stores activity log entries: type, duration, RPE,
-- calories burned, notes.

create table if not exists activities (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  date       date not null,
  data       jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table activities enable row level security;

drop policy if exists "Users own activities" on activities;
create policy "Users own activities" on activities
  for all using (auth.uid() = user_id);


-- ── 7. PROFILE HISTORY ──────────────────────────────────────
-- Append-only log of every profile change.
-- Used to show the user their history and to diagnose issues.
-- Each row is one change event: weight update, goal change,
-- supplement added, week plan modified, etc.

create table if not exists profile_history (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  change_type text,
  payload     jsonb,
  created_at  timestamptz default now()
);

alter table profile_history enable row level security;

drop policy if exists "Users own profile_history" on profile_history;
create policy "Users own profile_history" on profile_history
  for all using (auth.uid() = user_id);


-- ── INDEXES ─────────────────────────────────────────────────
-- Speed up the most common queries: fetching by user + date.

create index if not exists idx_day_logs_user_date
  on day_logs(user_id, date desc);

create index if not exists idx_macros_user_date
  on macros(user_id, date desc);

create index if not exists idx_meal_plans_user_week
  on meal_plans(user_id, week_start desc);

create index if not exists idx_week_ledger_user_week
  on week_ledger(user_id, week_start desc);

create index if not exists idx_activities_user_date
  on activities(user_id, date desc);

create index if not exists idx_profile_history_user
  on profile_history(user_id, created_at desc);
