export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      leagues: {
        Row: {
          id: string
          name: string
          join_code: string
          created_by: string
          picks_locked: boolean
          picks_locked_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['leagues']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['leagues']['Insert']>
      }
      league_members: {
        Row: {
          id: string
          league_id: string
          user_id: string
          display_name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['league_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['league_members']['Insert']>
      }
      picks: {
        Row: {
          id: string
          member_id: string
          player_id: string
          slot: 'GK' | 'outfield'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['picks']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['picks']['Insert']>
      }
      players: {
        Row: {
          id: string
          api_id: number
          name: string
          short_name: string
          position: 'GK' | 'DEF' | 'MID' | 'FWD'
          country: string
          country_code: string
          photo_url: string | null
          jersey_number: number | null
          seeded_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      matches: {
        Row: {
          id: string
          api_id: number
          home_team: string
          away_team: string
          home_country_code: string
          away_country_code: string
          home_score: number | null
          away_score: number | null
          status: string
          stage: string
          match_date: string
          synced_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
      }
      player_match_stats: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['player_match_stats']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['player_match_stats']['Insert']>
      }
    }
  }
}
