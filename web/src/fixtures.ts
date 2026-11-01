export type FixtureTeam = {
  id: string
  name: string
}

export type FixtureEntrant =
  | { type: 'team'; team: FixtureTeam }
  | { type: 'winner'; matchNumber: number }

export type KnockoutMatch = {
  number: number
  teamA: FixtureEntrant
  teamB?: FixtureEntrant
  bye: boolean
}

export type KnockoutRound = {
  name: string
  matches: KnockoutMatch[]
}

function roundName(matchCount: number) {
  if (matchCount === 1) return 'Final'
  if (matchCount === 2) return 'Semi-finals'
  if (matchCount === 4) return 'Quarter-finals'
  return `Round of ${matchCount * 2}`
}

export function generateKnockoutRounds(teams: readonly FixtureTeam[]): KnockoutRound[] {
  if (teams.length < 2) throw new Error('A knockout bracket needs at least two teams.')
  if (new Set(teams.map((team) => team.id)).size !== teams.length) throw new Error('Team IDs must be unique.')

  const bracketSize = 2 ** Math.ceil(Math.log2(teams.length))
  const byeCount = bracketSize - teams.length
  const openingMatches: KnockoutMatch[] = []

  for (let index = 0; index < byeCount; index += 1) {
    openingMatches.push({
      number: openingMatches.length + 1,
      teamA: { type: 'team', team: teams[index] },
      bye: true,
    })
  }

  const playingTeams = teams.slice(byeCount)
  for (let index = 0; index < playingTeams.length; index += 2) {
    openingMatches.push({
      number: openingMatches.length + 1,
      teamA: { type: 'team', team: playingTeams[index] },
      teamB: { type: 'team', team: playingTeams[index + 1] },
      bye: false,
    })
  }

  const rounds: KnockoutRound[] = [{
    name: byeCount ? 'Opening round' : roundName(openingMatches.length),
    matches: openingMatches,
  }]
  let previousMatches = openingMatches

  while (previousMatches.length > 1) {
    const matches: KnockoutMatch[] = []
    for (let index = 0; index < previousMatches.length; index += 2) {
      matches.push({
        number: matches.length + 1,
        teamA: { type: 'winner', matchNumber: previousMatches[index].number },
        teamB: { type: 'winner', matchNumber: previousMatches[index + 1].number },
        bye: false,
      })
    }
    rounds.push({ name: roundName(matches.length), matches })
    previousMatches = matches
  }

  return rounds
}
