-- Run this in the Supabase SQL editor
-- Creates the tables that were missing from the sync

-- Activities table (workout log entries)
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  date date not null,
  data jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date)
);
alter table activities enable row level security;
create policy "Users own activities" on activities
  for all using (auth.uid() = user_id);

-- Week ledger table (training week view data)
create table if not exists week_ledger (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  week_start date not null,
  data jsonb,
  updated_at timestamptz default now(),
  unique(user_id, week_start)
);
alter table week_ledger enable row level security;
create policy "Users own week_ledger" on week_ledger
  for all using (auth.uid() = user_id);

-- Add extra columns to profiles table for data that belongs to the user object
alter table profiles
  add column if not exists strength_baseline jsonb,
  add column if not exists scan_data jsonb,
  add column if not exists podcast_history jsonb,
  add column if not exists latest_report jsonb,
  add column if not exists fridge_data jsonb,
  add column if not exists shop_data jsonb;
