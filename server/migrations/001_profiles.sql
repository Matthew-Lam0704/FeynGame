-- 001_profiles.sql
-- Profiles table for persistent player state: coins, owned avatar frames, and selected frame.
-- Apply via Supabase Dashboard → SQL Editor (run as the postgres role).
--
-- Security model:
--   * coins and owned_frames are server-authoritative — only the service-role key
--     (used by server/index.js) can mutate them. Authenticated users have UPDATE
--     revoked on those columns.
--   * selected_frame_id is a UI preference — users may update it on their own row.
--   * A trigger seeds a profile row with 240 starting coins on every new auth user.

create table if not exists public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  coins             integer not null default 240 check (coins >= 0),
  selected_frame_id text default null,
  owned_frames      text[] not null default '{}',
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read: users see only their own profile row.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select
  using (auth.uid() = user_id);

-- Update: users may update their own row, but column-level grants below restrict
-- which columns they can actually modify (selected_frame_id + updated_at only).
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lock down coins/owned_frames at the column level. Service-role bypasses RLS
-- and column grants, so the server can still write them.
revoke update on public.profiles from authenticated;
grant  update (selected_frame_id, updated_at) on public.profiles to authenticated;

-- Auto-create a profile row whenever a new auth.users row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any existing users that signed up before this migration.
insert into public.profiles (user_id)
select id from auth.users
on conflict do nothing;
