-- Allow anyone (including unauthenticated) to read leagues and member counts.
-- Leagues are invite-only to join but their existence is not secret — the join
-- page needs to show league name and member count before the user signs up.

drop policy if exists "leagues_public_read" on leagues;
create policy "leagues_public_read" on leagues for select using (true);

drop policy if exists "league_members_public_read" on league_members;
create policy "league_members_public_read" on league_members for select using (true);
