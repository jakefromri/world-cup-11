import type { PlayerMatchStats, Pick } from '@/types'

const POINTS = {
  teamWinOutfield: 3,
  teamDrawOutfield: 1,
  teamWinGK: 3,
  teamDrawGK: 1,
  goal: 5,
  assist: 3,
  cleanSheet: 5,
  save: 0.5,
}

export function computeRawPoints(stats: PlayerMatchStats, isGK: boolean, matchResult: 'win' | 'draw' | 'loss'): number {
  let pts = 0

  if (matchResult === 'win') pts += isGK ? POINTS.teamWinGK : POINTS.teamWinOutfield
  else if (matchResult === 'draw') pts += isGK ? POINTS.teamDrawGK : POINTS.teamDrawOutfield

  pts += stats.goals * POINTS.goal
  pts += stats.assists * POINTS.assist

  if (isGK) {
    if (stats.clean_sheet) pts += POINTS.cleanSheet
    pts += stats.saves * POINTS.save
  }

  return pts
}

// Given raw points and the count of pickers in a league, return split points
export function splitPoints(rawPoints: number, pickerCount: number): number {
  if (pickerCount === 0) return 0
  return rawPoints / pickerCount
}

// Compute total points for a member in a league
// picks: member's picks, statsMap: player_id -> {stats, pickerCount, slot}
export function computeMemberPoints(
  picks: Pick[],
  statsMap: Map<string, { stats: PlayerMatchStats[]; pickerCount: number; slot: string }>,
  matches: Map<string, { homeScore: number; awayScore: number; homeTeam: string; awayTeam: string }>
): number {
  let total = 0

  for (const pick of picks) {
    const entry = statsMap.get(pick.player_id)
    if (!entry) continue

    for (const stat of entry.stats) {
      const match = matches.get(stat.match_id)
      if (!match) continue

      // Determine match result for this player's team
      // We need the player's country — stored separately; scoring query handles this
      const raw = computeRawPoints(stat, pick.slot === 'GK', 'win') // placeholder
      total += splitPoints(raw, entry.pickerCount)
    }
  }

  return total
}
