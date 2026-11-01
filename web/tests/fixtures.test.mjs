import assert from 'node:assert/strict'
import test from 'node:test'
import { generateGroupStage, generateKnockoutRounds, generateRoundRobinRounds, generateTwoGroupPlayoffRounds, listPlayableFixtures, parseGroupPlayoffFixtures, ROUND_ROBIN_TEAM_LIMIT } from '../src/fixtures.ts'

const teams = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id }))

test('round robin schedules each pair exactly once', () => {
  const rounds = generateRoundRobinRounds(teams)
  const pairs = rounds.flatMap((round) => round.matches.map((match) => [match.teamA.id, match.teamB.id].sort().join('-')))

  assert.equal(rounds.length, 3)
  assert.equal(pairs.length, 6)
  assert.equal(new Set(pairs).size, 6)
})

test('odd team count gives each team one bye', () => {
  const rounds = generateRoundRobinRounds(teams.slice(0, 3))
  const matches = rounds.flatMap((round) => round.matches)
  const byes = matches.filter((match) => match.bye).map((match) => match.teamA.id)

  assert.equal(rounds.length, 3)
  assert.equal(new Set(byes).size, 3)
  assert.equal(matches.filter((match) => !match.bye).length, 3)
})

test('round robin rejects too few teams and duplicate IDs', () => {
  assert.throws(() => generateRoundRobinRounds(teams.slice(0, 1)))
  assert.throws(() => generateRoundRobinRounds([teams[0], teams[0]]))
})

test('round robin rejects schedules above the single-document size limit', () => {
  const tooManyTeams = Array.from({ length: ROUND_ROBIN_TEAM_LIMIT + 1 }, (_, index) => ({ id: String(index), name: `Team ${index}` }))
  assert.throws(() => generateRoundRobinRounds(tooManyTeams), /supports up to/)
})

test('group stage balances teams and schedules matches within each group', () => {
  const sevenTeams = Array.from({ length: 7 }, (_, index) => ({ id: String(index), name: `Team ${index}` }))
  const groups = generateGroupStage(sevenTeams, 3)

  assert.deepEqual(groups.map((group) => group.teams.length), [3, 2, 2])
  assert.deepEqual(groups.map((group) => group.rounds.flatMap((round) => round.matches).filter((match) => !match.bye).length), [3, 1, 1])
})

test('group stage requires enough unique teams and a valid group count', () => {
  assert.throws(() => generateGroupStage(teams.slice(0, 3), 2))
  assert.throws(() => generateGroupStage(teams, 1))
  assert.throws(() => generateGroupStage([teams[0], teams[1], teams[2], teams[0]], 2))
})

test('generates a cross-group semifinal bracket from selected winners and runners-up', () => {
  const groups = generateGroupStage(teams, 2)
  const rounds = generateTwoGroupPlayoffRounds(groups, [
    { winnerId: groups[0].teams[0].id, runnerUpId: groups[0].teams[1].id },
    { winnerId: groups[1].teams[0].id, runnerUpId: groups[1].teams[1].id },
  ])

  assert.equal(rounds.length, 2)
  assert.deepEqual(rounds[0].matches.map(({ teamA, teamB }) => [teamA.team.id, teamB.team.id]), [
    [groups[0].teams[0].id, groups[1].teams[1].id],
    [groups[1].teams[0].id, groups[0].teams[1].id],
  ])
  assert.throws(() => generateTwoGroupPlayoffRounds(groups.slice(0, 1), []), /exactly two groups/)
  assert.throws(() => generateTwoGroupPlayoffRounds(groups, [
    { winnerId: groups[0].teams[0].id, runnerUpId: groups[0].teams[0].id },
    { winnerId: groups[1].teams[0].id, runnerUpId: groups[1].teams[1].id },
  ]), /two different qualifiers/)
  assert.throws(() => generateTwoGroupPlayoffRounds(groups, [
    { winnerId: groups[1].teams[0].id, runnerUpId: groups[0].teams[1].id },
    { winnerId: groups[1].teams[0].id, runnerUpId: groups[1].teams[1].id },
  ]), /belong to its group/)
})

test('validates saved group playoff qualifiers and bracket relationships', () => {
  const groups = generateGroupStage(teams, 2)
  const qualifiers = groups.map((group) => ({ groupName: group.name, winnerId: group.teams[0].id, runnerUpId: group.teams[1].id }))
  const rounds = generateTwoGroupPlayoffRounds(groups, qualifiers)
  const saved = { format: 'GROUP_PLAYOFFS', qualifiers, rounds }

  assert.deepEqual(parseGroupPlayoffFixtures(saved), { qualifiers, rounds })
  assert.throws(() => parseGroupPlayoffFixtures({ ...saved, qualifiers: [{ ...qualifiers[0], winnerId: '' }, qualifiers[1] ] }), /qualifiers are invalid/)
  assert.throws(() => parseGroupPlayoffFixtures({ ...saved, rounds: [{ ...rounds[0], matches: [] }, rounds[1] ] }), /does not match its qualifiers/)
})

test('lists concrete playable matches and excludes byes and unresolved knockout entrants', () => {
  const fixtures = listPlayableFixtures(
    generateKnockoutRounds(teams),
    generateRoundRobinRounds(teams.slice(0, 3)),
    generateGroupStage(teams, 2),
  )

  assert.equal(fixtures.length, 7)
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, fixtures.length)
  assert.deepEqual(fixtures.slice(0, 2).map(({ stage, roundName }) => [stage, roundName]), [['KNOCKOUT', 'Semi-finals'], ['KNOCKOUT', 'Semi-finals']])
  assert.equal(fixtures.at(-1).stage, 'GROUP')
  assert.equal(fixtures.every(({ teamA, teamB }) => Boolean(teamA.id && teamB.id)), true)
  assert.equal(fixtures.some(({ roundName }) => roundName === 'Final'), false)
})
