-- Prevent two members of the same league from having the same display name
alter table league_members
  add constraint league_members_unique_display_name
  unique (league_id, display_name);

-- RPC: resolve a player username to their auth email.
-- Only returns an email for accounts that used a synthetic @wc11.play address
-- (i.e. signed up with a player name, no real email).
-- Returns null if the username belongs to a real-email account → caller should
-- tell the user to sign in with their email address instead.
create or replace function public.resolve_username(p_username text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email
  from auth.users
  where lower(raw_user_meta_data->>'username') = lower(trim(p_username))
    and raw_user_meta_data->>'synthetic_email' = 'true'
  limit 1;
$$;
