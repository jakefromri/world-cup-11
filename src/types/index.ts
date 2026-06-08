export interface League {
  id: string
  name: string
  join_code: string
  created_by: string
  picks_locked: boolean
  picks_locked_at: string | null
  created_at: string
}

export interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  display_name: string
  created_at: string
}

export interface Player {
  id: string
  api_id: number
  name: string
  short_name: string
  full_name: string | null
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  country: string
  country_code: string
  photo_url: string | null
  jersey_number: number | null
  birth_date: string | null
  club_name: string | null
  club_logo_url: string | null
  club_season: string | null
  club_goals: number
  club_assists: number
  club_saves: number
  club_clean_sheets: number
  wc_squad: boolean
  seeded_at: string | null
}

export interface Pick {
  id: string
  member_id: string
  player_id: string
  slot: 'GK' | 'outfield'
  created_at: string
  player?: Player
}

export interface Match {
  id: string
  api_id: number
  home_team: string
  away_team: string
  home_country_code: string
  away_country_code: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'finished'
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  match_date: string
  synced_at: string | null
}

export interface PlayerMatchStats {
  id: string
  player_id: string
  match_id: string
  goals: number
  assists: number
  saves: number
  minutes_played: number
  clean_sheet: boolean
  yellow_card: boolean
  red_card: boolean
  synced_at: string | null
}

export interface MatchBreakdown {
  homeTeam: string
  awayTeam: string
  result: 'win' | 'draw' | 'loss'
  goals: number
  assists: number
  saves: number
  cleanSheet: boolean
  rawPoints: number
  pickerCount: number
  splitPoints: number
}

export interface PlayerPoints {
  total: number
  breakdown: MatchBreakdown[]
}

export interface LeaderboardEntry {
  member: LeagueMember
  picks: (Pick & { player: Player })[]
  totalPoints: number
  groupPoints: number
  playerPoints: Record<string, PlayerPoints>
}
