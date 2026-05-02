-- 002_profile_functions.sql
-- Atomic RPCs for coin grants and frame purchases.
-- Apply via Supabase Dashboard → SQL Editor (run as the postgres role) AFTER 001_profiles.sql.
--
-- Both functions are SECURITY DEFINER so they run with the function owner's
-- privileges (postgres) — that lets them write to columns where the authenticated
-- role's UPDATE has been revoked. Server callers using the service-role key would
-- already bypass RLS, but defining as SECURITY DEFINER also keeps the door open
-- for future direct-from-client RPC calls if we ever choose to expose them.

create or replace function public.award_coins(p_user uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_coins integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.profiles
     set coins      = coins + p_amount,
         updated_at = now()
   where user_id = p_user
  returning coins into new_coins;

  if new_coins is null then
    raise exception 'profile not found for user %', p_user;
  end if;

  return new_coins;
end;
$$;

create or replace function public.purchase_frame(
  p_user     uuid,
  p_frame_id text,
  p_price    integer
)
returns table (coins integer, owned_frames text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins  integer;
  v_frames text[];
begin
  if p_price < 0 then
    raise exception 'price must be non-negative';
  end if;

  -- Lock the row while we check + write to avoid double-spend races.
  select p.coins, p.owned_frames
    into v_coins, v_frames
    from public.profiles p
   where p.user_id = p_user
     for update;

  if not found then
    raise exception 'profile not found for user %', p_user;
  end if;

  if p_frame_id = any(v_frames) then
    raise exception 'frame already owned';
  end if;

  if v_coins < p_price then
    raise exception 'insufficient coins';
  end if;

  update public.profiles
     set coins        = coins - p_price,
         owned_frames = array_append(owned_frames, p_frame_id),
         updated_at   = now()
   where user_id = p_user
  returning coins, owned_frames
       into v_coins, v_frames;

  return query select v_coins, v_frames;
end;
$$;

-- Lock these down: only the service role (server) may call them.
revoke execute on function public.award_coins(uuid, integer)            from public, anon, authenticated;
revoke execute on function public.purchase_frame(uuid, text, integer)   from public, anon, authenticated;
grant  execute on function public.award_coins(uuid, integer)            to service_role;
grant  execute on function public.purchase_frame(uuid, text, integer)   to service_role;
