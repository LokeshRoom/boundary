import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePointsTable } from '../src/standings.ts'

const teams = [
  { id: 'cedar', name: 'Cedar CC' },
  { id: 'ridge', name: 'Ridge Club' },
  { id: 'vale', name: 'Vale XI' },
]

test('aggregates played, win, loss, tie, no-result, and points columns', () => {
  assert.deepEqual(calculatePointsTable(teams, [
    { id: 'match-1', teamAId: 'cedar', teamBId: 'ridge', outcome: 'TEAM_A_WIN' },
    { id: 'match-2', teamAId: 'ridge', teamBId: 'vale', outcome: 'TIE' },
    { id: 'match-3', teamAId: 'cedar', teamBId: 'vale', outcome: 'NO_RESULT' },
  ]), [
    { team: teams[0], played: 2, wins: 1, losses: 0, ties: 0, noResults: 1, points: 3 },
    { team: teams[1], played: 2, wins: 0, losses: 1, ties: 1, noResults: 0, points: 1 },
    { team: teams[2], played: 2, wins: 0, losses: 0, ties: 1, noResults: 1, points: 2 },
  ])
})

test('includes teams without results and rejects duplicate or invalid match data', () => {
  assert.deepEqual(calculatePointsTable(teams, []).map(({ played }) => played), [0, 0, 0])
  assert.throws(() => calculatePointsTable([teams[0], teams[0]], []), /unique/)
  assert.throws(() => calculatePointsTable(teams, [
    { id: 'match-1', teamAId: 'cedar', teamBId: 'ridge', outcome: 'TEAM_A_WIN' },
    { id: 'match-1', teamAId: 'cedar', teamBId: 'vale', outcome: 'TEAM_A_WIN' },
  ]), /invalid/)
  assert.throws(() => calculatePointsTable(teams, [
    { id: 'match-2', teamAId: 'cedar', teamBId: 'unknown', outcome: 'TEAM_A_WIN' },
  ]), /invalid/)
})
