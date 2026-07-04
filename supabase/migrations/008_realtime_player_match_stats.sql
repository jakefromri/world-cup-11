-- Let the homepage player leaderboard live-refresh when admin sync writes stats
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_match_stats'
  ) then
    alter publication supabase_realtime add table player_match_stats;
  end if;
end $$;
