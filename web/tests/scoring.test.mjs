import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeBattingScorecard, summarizeBowlingScorecard, summarizeInnings, undoLastDelivery } from '../src/scoring.ts'

const delivery = (overrides = {}) => ({ strikerId: 'batter-1', bowlerId: 'bowler-1', runsOffBat: 0, extrasRuns: 0, legalBall: true, isWicket: false, ...overrides })

test('summarizes runs, extras, wickets, legal balls, overs, and run rate', () => {
  const deliveries = [
    delivery({ runsOffBat: 4 }),
    delivery({ extrasType: 'WIDE', extrasRuns: 2, legalBall: false }),
    delivery({ runsOffBat: 2, extrasType: 'NO_BALL', extrasRuns: 1, legalBall: false }),
    delivery({ extrasType: 'BYE', extrasRuns: 1 }),
    delivery({ isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'BOWLED' }),
    delivery({ runsOffBat: 1 }),
  ]

  assert.deepEqual(summarizeInnings(deliveries, 6), {
    runsOffBat: 7,
    wickets: 1,
    legalBalls: 4,
    overs: '0.4',
    runRate: 16.5,
    extras: { WIDE: 2, NO_BALL: 1, BYE: 1, LEG_BYE: 0, PENALTY: 0 },
    runs: 11,
  })
})

test('formats completed overs and handles a score before the first legal ball', () => {
  assert.equal(summarizeInnings(Array.from({ length: 6 }, () => delivery()), 6).overs, '1.0')
  assert.equal(summarizeInnings([delivery({ extrasType: 'WIDE', extrasRuns: 1, legalBall: false })], 6).runRate, 0)
})

test('rejects malformed extras and invalid over settings', () => {
  assert.throws(() => summarizeInnings([delivery({ extrasRuns: 1 })], 6), /extras type/)
  assert.throws(() => summarizeInnings([delivery({ extrasType: 'WIDE', extrasRuns: 1 })], 6), /do not count/)
  assert.throws(() => summarizeInnings([], 0), /positive integer/)
})

test('undo removes only the most recent delivery', () => {
  const deliveries = [delivery({ runsOffBat: 1 }), delivery({ runsOffBat: 4 })]
  assert.deepEqual(undoLastDelivery(deliveries), [deliveries[0]])
  assert.deepEqual(undoLastDelivery([]), [])
})

test('builds batting figures with wides excluded and no-balls faced', () => {
  const scorecard = summarizeBattingScorecard([
    delivery({ runsOffBat: 4 }),
    delivery({ runsOffBat: 2, extrasType: 'NO_BALL', extrasRuns: 1, legalBall: false }),
    delivery({ runsOffBat: 1, strikerId: 'batter-2', isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'RUN_OUT' }),
    delivery({ strikerId: 'batter-2', extrasType: 'WIDE', extrasRuns: 1, legalBall: false }),
  ], ['batter-1', 'batter-2'])

  assert.deepEqual(scorecard, [
    { playerId: 'batter-1', runs: 6, ballsFaced: 2, fours: 1, sixes: 0, dismissed: true, strikeRate: 300 },
    { playerId: 'batter-2', runs: 1, ballsFaced: 1, fours: 0, sixes: 0, dismissed: false, strikeRate: 100 },
  ])
})

test('batting scorecard rejects unknown batters and invalid wicket attribution', () => {
  assert.throws(() => summarizeBattingScorecard([delivery()], ['batter-2']), /striker/)
  assert.throws(() => summarizeBattingScorecard([delivery({ isWicket: true })], ['batter-1']), /dismissed batter/)
})

test('builds bowling figures while excluding byes, leg-byes, penalty runs, and uncredited wickets', () => {
  const deliveries = [
    delivery({ runsOffBat: 4 }),
    delivery({ extrasType: 'WIDE', extrasRuns: 2, legalBall: false }),
    delivery({ runsOffBat: 1, extrasType: 'NO_BALL', extrasRuns: 1, legalBall: false }),
    delivery({ extrasType: 'BYE', extrasRuns: 3 }),
    delivery({ extrasType: 'LEG_BYE', extrasRuns: 1 }),
    delivery({ isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'BOWLED' }),
    delivery({ runsOffBat: 1, isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'RUN_OUT' }),
    delivery({ extrasType: 'PENALTY', extrasRuns: 5, legalBall: false }),
  ]

  assert.deepEqual(summarizeBowlingScorecard(deliveries, ['bowler-1'], 6), [
    { playerId: 'bowler-1', runsConceded: 9, legalBalls: 5, overs: '0.5', wickets: 1, economy: 10.8 },
  ])
})

test('bowling scorecard rejects unknown bowlers and mismatched wicket types', () => {
  assert.throws(() => summarizeBowlingScorecard([delivery()], ['bowler-2'], 6), /bowling lineup/)
  assert.throws(() => summarizeBowlingScorecard([delivery({ isWicket: true, dismissedBatterId: 'batter-1' })], ['bowler-1'], 6), /dismissal type/)
})
