-- Allow members to update their own display_name
create policy "members_update_own" on league_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
