import type { FixtureTeam } from './fixtures'

export type MatchOutcome = 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'TIE' | 'NO_RESULT'

export type StandingsMatch = {
  id: string
  teamAId: string
  teamBId: string
  outcome: MatchOutcome
}

export type PointsTableRow = {
  team: FixtureTeam
  played: number
  wins: number
  losses: number
  ties: number
  noResults: number
  points: number
}

export function calculatePointsTable(teams: readonly FixtureTeam[], matches: readonly StandingsMatch[]): PointsTableRow[] {
  const rows = new Map<string, PointsTableRow>()
  teams.forEach((team) => {
    if (!team.id.trim() || !team.name.trim() || rows.has(team.id)) throw new Error('Standings teams must have unique non-empty IDs and names.')
    rows.set(team.id, { team, played: 0, wins: 0, losses: 0, ties: 0, noResults: 0, points: 0 })
  })

  const matchIds = new Set<string>()
  matches.forEach(({ id, teamAId, teamBId, outcome }) => {
    if (!id.trim() || matchIds.has(id) || teamAId === teamBId || !rows.has(teamAId) || !rows.has(teamBId) || !['TEAM_A_WIN', 'TEAM_B_WIN', 'TIE', 'NO_RESULT'].includes(outcome)) {
      throw new Error('Standings match data is invalid.')
    }
    matchIds.add(id)
    const teamA = rows.get(teamAId)!
    const teamB = rows.get(teamBId)!
    teamA.played += 1
    teamB.played += 1

    if (outcome === 'TIE' || outcome === 'NO_RESULT') {
      const key = outcome === 'TIE' ? 'ties' : 'noResults'
      teamA[key] += 1
      teamB[key] += 1
      teamA.points += 1
      teamB.points += 1
      return
    }

    const winner = outcome === 'TEAM_A_WIN' ? teamA : teamB
    const loser = outcome === 'TEAM_A_WIN' ? teamB : teamA
    winner.wins += 1
    winner.points += 2
    loser.losses += 1
  })

  return [...rows.values()]
}
