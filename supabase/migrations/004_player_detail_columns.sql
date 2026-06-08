alter table players
  add column if not exists full_name text,
  add column if not exists birth_date date,
  add column if not exists club_name text,
  add column if not exists club_logo_url text,
  add column if not exists club_season text,
  add column if not exists club_goals integer not null default 0,
  add column if not exists club_assists integer not null default 0,
  add column if not exists club_saves integer not null default 0,
  add column if not exists club_clean_sheets integer not null default 0;
