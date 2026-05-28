-- Enable UUID extension
create extension if not exists "pgcrypto";

-- leagues
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  picks_locked boolean not null default false,
  picks_locked_at timestamptz,
  created_at timestamptz not null default now()
);

-- league_members
create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- players
create table players (
  id uuid primary key default gen_random_uuid(),
  api_id integer unique not null,
  name text not null,
  short_name text not null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  country text not null,
  country_code text not null,
  photo_url text,
  jersey_number integer,
  seeded_at timestamptz
);

-- picks
create table picks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references league_members(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  slot text not null check (slot in ('GK', 'outfield')),
  created_at timestamptz not null default now(),
  unique (member_id, player_id)
);

-- Enforce exactly 1 GK per member via partial unique index
create unique index picks_one_gk_per_member on picks (member_id) where (slot = 'GK');

-- matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  api_id integer unique not null,
  home_team text not null,
  away_team text not null,
  home_country_code text not null default '',
  away_country_code text not null default '',
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  stage text not null default 'group' check (stage in ('group', 'r32', 'r16', 'qf', 'sf', 'final')),
  match_date timestamptz not null,
  synced_at timestamptz
);

-- player_match_stats
create table player_match_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  goals integer not null default 0,
  assists integer not null default 0,
  saves integer not null default 0,
  minutes_played integer not null default 0,
  clean_sheet boolean not null default false,
  yellow_card boolean not null default false,
  red_card boolean not null default false,
  synced_at timestamptz,
  unique (player_id, match_id)
);

-- =====================
-- RLS
-- =====================

alter table leagues enable row level security;
alter table league_members enable row level security;
alter table picks enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table player_match_stats enable row level security;

-- leagues: public read; creator can update/delete
create policy "leagues_public_read" on leagues for select using (true);
create policy "leagues_creator_insert" on leagues for insert with check (auth.uid() = created_by);
create policy "leagues_creator_update" on leagues for update using (auth.uid() = created_by);
create policy "leagues_creator_delete" on leagues for delete using (auth.uid() = created_by);

-- league_members: members of a league can see all members; authenticated can insert themselves
create policy "members_read_own_league" on league_members for select
  using (
    league_id in (
      select league_id from league_members where user_id = auth.uid()
    )
  );
create policy "members_insert_self" on league_members for insert
  with check (auth.uid() = user_id);

-- picks: members of a league can read all picks in it; users can upsert their own
create policy "picks_read_league_members" on picks for select
  using (
    member_id in (
      select lm.id from league_members lm
      join league_members my_lm on my_lm.league_id = lm.league_id
      where my_lm.user_id = auth.uid()
    )
  );
create policy "picks_insert_own" on picks for insert
  with check (
    member_id in (
      select id from league_members where user_id = auth.uid()
    )
  );
create policy "picks_delete_own" on picks for delete
  using (
    member_id in (
      select id from league_members where user_id = auth.uid()
    )
  );

-- players: public read; only service role can write
create policy "players_public_read" on players for select using (true);

-- matches: public read; only service role can write
create policy "matches_public_read" on matches for select using (true);

-- player_match_stats: public read; only service role can write
create policy "stats_public_read" on player_match_stats for select using (true);
