import assert from 'node:assert/strict'
import test from 'node:test'
import { generateRoundRobinRounds, ROUND_ROBIN_TEAM_LIMIT } from '../src/fixtures.ts'

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
