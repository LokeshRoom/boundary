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

export type RoundRobinMatch = {
  teamA: FixtureTeam
  teamB?: FixtureTeam
  bye: boolean
}

export type RoundRobinRound = {
  name: string
  matches: RoundRobinMatch[]
}

export type GroupStageGroup = {
  name: string
  teams: FixtureTeam[]
  rounds: RoundRobinRound[]
}

export type GroupPlayoffQualifier = { groupName: string; winnerId: string; runnerUpId: string }
export type GroupPlayoffFixtures = { qualifiers: GroupPlayoffQualifier[]; rounds: KnockoutRound[] }

export type PlayableFixture = {
  id: string
  stage: 'KNOCKOUT' | 'LEAGUE' | 'GROUP'
  roundName: string
  matchNumber: number
  groupName?: string
  teamA: FixtureTeam
  teamB: FixtureTeam
}

export const ROUND_ROBIN_TEAM_LIMIT = 64

export function listPlayableFixtures(
  knockoutRounds: readonly KnockoutRound[] = [],
  leagueRounds: readonly RoundRobinRound[] = [],
  groups: readonly GroupStageGroup[] = [],
): PlayableFixture[] {
  const fixtures: PlayableFixture[] = []

  knockoutRounds.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
    if (match.bye || match.teamA.type !== 'team' || !match.teamB || match.teamB.type !== 'team') return
    fixtures.push({
      id: `knockout-round-${roundIndex + 1}-match-${matchIndex + 1}`,
      stage: 'KNOCKOUT',
      roundName: round.name,
      matchNumber: match.number,
      teamA: match.teamA.team,
      teamB: match.teamB.team,
    })
  }))

  leagueRounds.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
    if (match.bye || !match.teamB) return
    fixtures.push({
      id: `league-round-${roundIndex + 1}-match-${matchIndex + 1}`,
      stage: 'LEAGUE',
      roundName: round.name,
      matchNumber: matchIndex + 1,
      teamA: match.teamA,
      teamB: match.teamB,
    })
  }))

  groups.forEach((group, groupIndex) => group.rounds.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
    if (match.bye || !match.teamB) return
    fixtures.push({
      id: `group-${groupIndex + 1}-round-${roundIndex + 1}-match-${matchIndex + 1}`,
      stage: 'GROUP',
      groupName: group.name,
      roundName: round.name,
      matchNumber: matchIndex + 1,
      teamA: match.teamA,
      teamB: match.teamB,
    })
  })))

  return fixtures
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

export function generateTwoGroupPlayoffRounds(
  groups: readonly GroupStageGroup[],
  qualifiers: readonly { winnerId: string; runnerUpId: string }[],
): KnockoutRound[] {
  if (groups.length !== 2 || qualifiers.length !== 2) throw new Error('A group playoff bracket needs exactly two groups and two qualifiers per group.')
  const getTeam = (group: GroupStageGroup, id: string) => {
    const team = group.teams.find(({ id: teamId }) => teamId === id)
    if (!team) throw new Error('Each playoff qualifier must belong to its group.')
    return team
  }
  const seeded = groups.map((group, index) => {
    const { winnerId, runnerUpId } = qualifiers[index]
    if (!winnerId || !runnerUpId || winnerId === runnerUpId) throw new Error('Choose two different qualifiers for each group.')
    return { winner: getTeam(group, winnerId), runnerUp: getTeam(group, runnerUpId) }
  })
  if (new Set(seeded.flatMap(({ winner, runnerUp }) => [winner.id, runnerUp.id])).size !== 4) throw new Error('Playoff qualifiers must be unique.')

  return generateKnockoutRounds([
    seeded[0].winner,
    seeded[1].runnerUp,
    seeded[1].winner,
    seeded[0].runnerUp,
  ])
}

export function generateRoundRobinRounds(teams: readonly FixtureTeam[]): RoundRobinRound[] {
  if (teams.length < 2) throw new Error('A round-robin schedule needs at least two teams.')
  if (teams.length > ROUND_ROBIN_TEAM_LIMIT) throw new Error(`A round-robin schedule supports up to ${ROUND_ROBIN_TEAM_LIMIT} teams.`)
  if (new Set(teams.map((team) => team.id)).size !== teams.length) throw new Error('Team IDs must be unique.')

  const rotation: Array<FixtureTeam | null> = [...teams]
  if (rotation.length % 2 === 1) rotation.push(null)

  return Array.from({ length: rotation.length - 1 }, (_, roundIndex) => {
    const matches: RoundRobinMatch[] = []
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const teamA = rotation[index]
      const teamB = rotation[rotation.length - index - 1]
      if (teamA && teamB) matches.push({ teamA, teamB, bye: false })
      else if (teamA || teamB) matches.push({ teamA: teamA ?? teamB!, bye: true })
    }

    const lastTeam = rotation.pop()!
    rotation.splice(1, 0, lastTeam)
    return { name: `Round ${roundIndex + 1}`, matches }
  })
}

export function generateGroupStage(teams: readonly FixtureTeam[], groupCount: number): GroupStageGroup[] {
  if (teams.length < 4) throw new Error('A group stage needs at least four teams.')
  if (teams.length > ROUND_ROBIN_TEAM_LIMIT) throw new Error(`A group stage supports up to ${ROUND_ROBIN_TEAM_LIMIT} teams.`)
  if (!Number.isInteger(groupCount) || groupCount < 2 || groupCount > Math.floor(teams.length / 2)) {
    throw new Error('Choose at least two groups with at least two teams in each group.')
  }
  if (new Set(teams.map((team) => team.id)).size !== teams.length) throw new Error('Team IDs must be unique.')

  const groupedTeams = Array.from({ length: groupCount }, () => [] as FixtureTeam[])
  teams.forEach((team, index) => {
    const position = index % (groupCount * 2)
    const groupIndex = position < groupCount ? position : groupCount * 2 - position - 1
    groupedTeams[groupIndex].push(team)
  })

  return groupedTeams.map((groupTeams, index) => {
    const suffix = index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
    return {
      name: `Group ${suffix}`,
      teams: groupTeams,
      rounds: generateRoundRobinRounds(groupTeams),
    }
  })
}
