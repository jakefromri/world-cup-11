-- Fix recursive RLS on league_members.
-- The original "members_read_own_league" policy queries league_members inside
-- its own USING clause, which PostgreSQL evaluates recursively — the subquery
-- hits the same RLS policy again, resulting in an empty set.
-- Fix: a SECURITY DEFINER function runs as the definer (bypasses RLS), so the
-- subquery resolves without triggering the policy on itself.

create or replace function get_my_league_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select league_id from league_members where user_id = auth.uid()
$$;

drop policy if exists "members_read_own_league" on league_members;

create policy "members_read_own_league" on league_members for select
  using (league_id in (select get_my_league_ids()));

-- Same fix for picks: the correlated subquery also hits league_members RLS.
drop policy if exists "picks_read_league_members" on picks;

create or replace function get_my_member_ids_across_leagues()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select lm.id
  from league_members lm
  where lm.league_id in (select get_my_league_ids())
$$;

create policy "picks_read_league_members" on picks for select
  using (member_id in (select get_my_member_ids_across_leagues()));
