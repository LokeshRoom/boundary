import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceBattingEnds, buildInningsScorecard, buildLiveMatchSnapshot, flattenOverBatches, getBattingEndsAfter, groupDeliveriesByOver, isInningsComplete, summarizeBattingScorecard, summarizeBowlingScorecard, summarizeInnings, undoLastDelivery } from '../src/scoring.ts'

const delivery = (overrides = {}) => ({ strikerId: 'batter-1', bowlerId: 'bowler-1', completedRuns: 0, runsOffBat: 0, extrasRuns: 0, legalBall: true, isWicket: false, ...overrides })

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

test('groups historical deliveries by legal over without splitting wides or no-balls', () => {
  const deliveries = [
    delivery(),
    delivery({ extrasType: 'WIDE', extrasRuns: 1, legalBall: false }),
    delivery({ extrasType: 'NO_BALL', extrasRuns: 1, legalBall: false }),
    delivery(),
    delivery(),
    delivery({ extrasType: 'WIDE', extrasRuns: 1, legalBall: false }),
    delivery(),
  ]
  const batches = groupDeliveriesByOver(deliveries, 3)

  assert.deepEqual(batches.map(({ overNumber, deliveries: over }) => [overNumber, over.length]), [[1, 5], [2, 2]])
  assert.deepEqual(groupDeliveriesByOver([], 6), [])
  assert.throws(() => groupDeliveriesByOver(deliveries, 0), /positive integer/)
  assert.deepEqual(flattenOverBatches(batches, 3), deliveries)
  assert.deepEqual(flattenOverBatches([], 3), [])
  assert.throws(() => flattenOverBatches([{ overNumber: 2, deliveries: [delivery()] }], 3), /numbered consecutively/)
  assert.throws(() => flattenOverBatches([{ overNumber: 1, deliveries: [delivery()] }, { overNumber: 2, deliveries: [delivery()] }], 3), /full legal-ball limit/)
  assert.throws(() => flattenOverBatches([{ overNumber: 1, deliveries: Array.from({ length: 4 }, () => delivery()) }], 3), /cannot exceed/)
})

test('composes an innings total with batting and bowling figures', () => {
  const scorecard = buildInningsScorecard([
    delivery({ runsOffBat: 4 }),
    delivery({ strikerId: 'batter-2', runsOffBat: 1 }),
  ], ['batter-1', 'batter-2'], ['bowler-1'], 6)

  assert.equal(scorecard.summary.runs, 5)
  assert.equal(scorecard.batting.reduce((total, batter) => total + batter.runs, 0), 5)
  assert.equal(scorecard.bowling[0].runsConceded, 5)
})

test('builds a compact live snapshot with current totals and only the latest 18 deliveries', () => {
  const deliveries = Array.from({ length: 20 }, (_, index) => delivery({ runsOffBat: index % 2, completedRuns: index % 2 }))
  const snapshot = buildLiveMatchSnapshot(deliveries, 6, 2)

  assert.equal(snapshot.currentInnings, 2)
  assert.deepEqual(snapshot.scoreSummary, summarizeInnings(deliveries, 6))
  assert.equal(snapshot.recentBalls.length, 18)
  assert.equal(snapshot.recentBalls[0], deliveries[2])
  assert.equal(snapshot.recentBalls.at(-1), deliveries.at(-1))
  assert.throws(() => buildLiveMatchSnapshot([], 6, 3), /must be 1 or 2/)
})

test('ends an innings at the legal-ball limit or when all but one batter are out', () => {
  const overLimitBalls = [
    delivery({ extrasType: 'WIDE', extrasRuns: 1, legalBall: false }),
    delivery(),
    delivery(),
  ]
  assert.equal(isInningsComplete(overLimitBalls.slice(0, 2), 1, 3, 2), false)
  assert.equal(isInningsComplete(overLimitBalls, 1, 3, 2), true)
  assert.equal(isInningsComplete([
    delivery({ isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'BOWLED' }),
    delivery({ isWicket: true, dismissedBatterId: 'batter-2', dismissalType: 'CAUGHT' }),
  ], 20, 3, 6), true)
  assert.throws(() => isInningsComplete([], 0, 11, 6), /Overs limit/)
})

test('rotates the strike on odd completed runs and at the end of a legal over', () => {
  const ends = { strikerId: 'batter-1', nonStrikerId: 'batter-2' }
  assert.deepEqual(advanceBattingEnds(ends, delivery({ completedRuns: 1 }), 0, 6), { strikerId: 'batter-2', nonStrikerId: 'batter-1' })
  assert.deepEqual(advanceBattingEnds(ends, delivery({ legalBall: false }), 5, 6), ends)
  assert.deepEqual(advanceBattingEnds(ends, delivery(), 5, 6), { strikerId: 'batter-2', nonStrikerId: 'batter-1' })
  assert.deepEqual(advanceBattingEnds(ends, delivery({ completedRuns: 1 }), 5, 6), ends)
  assert.deepEqual(getBattingEndsAfter([delivery({ completedRuns: 1 }), delivery({ strikerId: 'batter-2' })], ends, 6), { strikerId: 'batter-2', nonStrikerId: 'batter-1' })
  assert.throws(() => advanceBattingEnds(ends, delivery({ strikerId: 'batter-2' }), 0, 6), /striker end/)
})

test('replaces a dismissed striker from the batting lineup and keeps history undoable', () => {
  const ends = { strikerId: 'batter-1', nonStrikerId: 'batter-2' }
  const wicket = delivery({ isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'BOWLED', incomingBatterId: 'batter-3' })
  assert.deepEqual(advanceBattingEnds(ends, wicket, 0, 6), { strikerId: 'batter-3', nonStrikerId: 'batter-2' })
  assert.deepEqual(getBattingEndsAfter([wicket], ends, 6), { strikerId: 'batter-3', nonStrikerId: 'batter-2' })
  assert.equal(summarizeBattingScorecard([wicket], ['batter-1', 'batter-2', 'batter-3'])[0].dismissed, true)
  assert.throws(() => summarizeBattingScorecard([wicket], ['batter-1', 'batter-2']), /incoming batter/)
  assert.deepEqual(undoLastDelivery([wicket]), [])
})

test('ends the innings on a wicket without a replacement batter', () => {
  const ends = { strikerId: 'batter-1', nonStrikerId: 'batter-2' }
  const finalWicket = delivery({ isWicket: true, dismissedBatterId: 'batter-1', dismissalType: 'BOWLED' })
  assert.deepEqual(getBattingEndsAfter([finalWicket], ends, 6), { strikerId: '', nonStrikerId: '' })
  assert.equal(summarizeInnings([finalWicket], 6).wickets, 1)
})
