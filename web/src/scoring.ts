export type ExtrasType = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY'
export type DismissalType = 'BOWLED' | 'CAUGHT' | 'LBW' | 'RUN_OUT' | 'STUMPED' | 'HIT_WICKET' | 'RETIRED_OUT'

export type DeliveryEvent = {
  strikerId: string
  bowlerId: string
  completedRuns: number
  dismissedBatterId?: string
  dismissalType?: DismissalType
  incomingBatterId?: string
  runsOffBat: number
  extrasType?: ExtrasType
  extrasRuns: number
  legalBall: boolean
  isWicket: boolean
}

export type InningsSummary = {
  runs: number
  wickets: number
  legalBalls: number
  overs: string
  runRate: number
  runsOffBat: number
  extras: Record<ExtrasType, number>
}

export type BatterSummary = {
  playerId: string
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  dismissed: boolean
  strikeRate: number
}

export type BowlerSummary = {
  playerId: string
  runsConceded: number
  legalBalls: number
  overs: string
  wickets: number
  economy: number
}

export type OverDeliveryBatch = {
  overNumber: number
  deliveries: DeliveryEvent[]
}

export type InningsScorecard = {
  summary: InningsSummary
  batting: BatterSummary[]
  bowling: BowlerSummary[]
}

export type BattingEnds = {
  strikerId: string
  nonStrikerId: string
}

const extrasTypes: ExtrasType[] = ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']

function validateDelivery(delivery: DeliveryEvent) {
  if (typeof delivery.strikerId !== 'string' || !delivery.strikerId.trim()) throw new Error('A striker ID is required for each delivery.')
  if (typeof delivery.bowlerId !== 'string' || !delivery.bowlerId.trim()) throw new Error('A bowler ID is required for each delivery.')
  if (!Number.isInteger(delivery.completedRuns) || delivery.completedRuns < 0) throw new Error('Completed runs must be a non-negative integer.')
  if (delivery.dismissedBatterId !== undefined && (typeof delivery.dismissedBatterId !== 'string' || !delivery.dismissedBatterId.trim())) throw new Error('A dismissed batter ID must be a non-empty string.')
  if (delivery.incomingBatterId !== undefined && (typeof delivery.incomingBatterId !== 'string' || !delivery.incomingBatterId.trim())) throw new Error('An incoming batter ID must be a non-empty string.')
  if (delivery.dismissalType && !['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED_OUT'].includes(delivery.dismissalType)) throw new Error('Unknown dismissal type.')
  if (delivery.isWicket !== Boolean(delivery.dismissedBatterId) || delivery.isWicket !== Boolean(delivery.dismissalType)) throw new Error('Wicket deliveries must identify the dismissed batter and dismissal type.')
  if (!Number.isInteger(delivery.runsOffBat) || delivery.runsOffBat < 0) throw new Error('Runs off the bat must be a non-negative integer.')
  if (!Number.isInteger(delivery.extrasRuns) || delivery.extrasRuns < 0) throw new Error('Extras must be a non-negative integer.')
  if (delivery.extrasRuns > 0 && !delivery.extrasType) throw new Error('Choose an extras type when extras are recorded.')
  if (delivery.extrasType && !extrasTypes.includes(delivery.extrasType)) throw new Error('Unknown extras type.')
  if (['WIDE', 'NO_BALL'].includes(delivery.extrasType ?? '') && delivery.legalBall) throw new Error('Wides and no-balls do not count as legal balls.')
  if (['WIDE', 'NO_BALL'].includes(delivery.extrasType ?? '') && delivery.extrasRuns < 1) throw new Error('Wides and no-balls must include at least one extra run.')
  if (typeof delivery.legalBall !== 'boolean' || typeof delivery.isWicket !== 'boolean') throw new Error('Delivery flags must be boolean values.')
}

export function advanceBattingEnds(
  ends: BattingEnds,
  delivery: DeliveryEvent,
  legalBallsInOverBefore: number,
  ballsPerOver: number,
): BattingEnds {
  validateDelivery(delivery)
  if (!ends.strikerId || !ends.nonStrikerId || ends.strikerId === ends.nonStrikerId) throw new Error('The striker and non-striker must be different players.')
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
  if (!Number.isInteger(legalBallsInOverBefore) || legalBallsInOverBefore < 0 || legalBallsInOverBefore >= ballsPerOver) throw new Error('Legal balls in the current over are out of range.')
  if (delivery.strikerId !== ends.strikerId) throw new Error('The delivery striker must be at the striker end.')
  if (delivery.isWicket && (delivery.dismissedBatterId !== ends.strikerId || delivery.completedRuns !== 0 || delivery.runsOffBat !== 0)) throw new Error('A wicket in the preview must dismiss the striker without completed runs.')
  if (delivery.isWicket && !delivery.incomingBatterId) return { strikerId: '', nonStrikerId: '' }

  const oddCompletedRuns = delivery.completedRuns % 2 === 1
  const overCompleted = delivery.legalBall && legalBallsInOverBefore + 1 === ballsPerOver
  const nextEnds = delivery.isWicket
    ? { strikerId: delivery.incomingBatterId as string, nonStrikerId: ends.nonStrikerId }
    : ends
  return oddCompletedRuns !== overCompleted
    ? { strikerId: nextEnds.nonStrikerId, nonStrikerId: nextEnds.strikerId }
    : nextEnds
}

export function getBattingEndsAfter(deliveries: readonly DeliveryEvent[], openingEnds: BattingEnds, ballsPerOver: number): BattingEnds {
  let ends = openingEnds
  let legalBallsInOver = 0
  deliveries.forEach((delivery) => {
    ends = advanceBattingEnds(ends, delivery, legalBallsInOver, ballsPerOver)
    legalBallsInOver = delivery.legalBall ? (legalBallsInOver + 1) % ballsPerOver : legalBallsInOver
  })
  return ends
}

export function summarizeBattingScorecard(deliveries: readonly DeliveryEvent[], batterIds: readonly string[]): BatterSummary[] {
  if (new Set(batterIds).size !== batterIds.length || batterIds.some((id) => !id.trim())) throw new Error('Batter IDs must be unique and non-empty.')
  const batters = new Map(batterIds.map((playerId) => [playerId, { playerId, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, dismissed: false, strikeRate: 0 }]))

  deliveries.forEach((delivery) => {
    validateDelivery(delivery)
    const batter = batters.get(delivery.strikerId)
    if (!batter) throw new Error('Every striker must be included in the batting lineup.')
    batter.runs += delivery.runsOffBat
    if (delivery.extrasType !== 'WIDE') batter.ballsFaced += 1
    if (delivery.runsOffBat === 4) batter.fours += 1
    if (delivery.runsOffBat === 6) batter.sixes += 1
    if (delivery.dismissedBatterId) {
      const dismissed = batters.get(delivery.dismissedBatterId)
      if (!dismissed) throw new Error('The dismissed batter must be included in the batting lineup.')
      dismissed.dismissed = true
    }
    if (delivery.incomingBatterId && !batters.has(delivery.incomingBatterId)) throw new Error('The incoming batter must be included in the batting lineup.')
  })

  return [...batters.values()].map((batter) => ({
    ...batter,
    strikeRate: batter.ballsFaced === 0 ? 0 : batter.runs * 100 / batter.ballsFaced,
  }))
}

export function summarizeBowlingScorecard(deliveries: readonly DeliveryEvent[], bowlerIds: readonly string[], ballsPerOver: number): BowlerSummary[] {
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
  if (new Set(bowlerIds).size !== bowlerIds.length || bowlerIds.some((id) => !id.trim())) throw new Error('Bowler IDs must be unique and non-empty.')
  const bowlers = new Map(bowlerIds.map((playerId) => [playerId, { playerId, runsConceded: 0, legalBalls: 0, wickets: 0 }]))

  deliveries.forEach((delivery) => {
    validateDelivery(delivery)
    const bowler = bowlers.get(delivery.bowlerId)
    if (!bowler) throw new Error('Every delivery bowler must be included in the bowling lineup.')
    const chargedExtras = delivery.extrasType === 'WIDE' || delivery.extrasType === 'NO_BALL' ? delivery.extrasRuns : 0
    bowler.runsConceded += delivery.runsOffBat + chargedExtras
    bowler.legalBalls += Number(delivery.legalBall)
    if (delivery.dismissalType && !['RUN_OUT', 'RETIRED_OUT'].includes(delivery.dismissalType)) bowler.wickets += 1
  })

  return [...bowlers.values()].map((bowler) => ({
    ...bowler,
    overs: `${Math.floor(bowler.legalBalls / ballsPerOver)}.${bowler.legalBalls % ballsPerOver}`,
    economy: bowler.legalBalls === 0 ? 0 : bowler.runsConceded * ballsPerOver / bowler.legalBalls,
  }))
}

export function buildInningsScorecard(
  deliveries: readonly DeliveryEvent[],
  batterIds: readonly string[],
  bowlerIds: readonly string[],
  ballsPerOver: number,
): InningsScorecard {
  return {
    summary: summarizeInnings(deliveries, ballsPerOver),
    batting: summarizeBattingScorecard(deliveries, batterIds),
    bowling: summarizeBowlingScorecard(deliveries, bowlerIds, ballsPerOver),
  }
}

export function summarizeInnings(deliveries: readonly DeliveryEvent[], ballsPerOver: number): InningsSummary {
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')

  const summary = deliveries.reduce((score, delivery) => {
    validateDelivery(delivery)
    score.runsOffBat += delivery.runsOffBat
    score.wickets += Number(delivery.isWicket)
    score.legalBalls += Number(delivery.legalBall)
    if (delivery.extrasType) score.extras[delivery.extrasType] += delivery.extrasRuns
    return score
  }, {
    runsOffBat: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0, PENALTY: 0 },
  })
  const extrasRuns = Object.values(summary.extras).reduce((total, runs) => total + runs, 0)

  return {
    ...summary,
    runs: summary.runsOffBat + extrasRuns,
    overs: `${Math.floor(summary.legalBalls / ballsPerOver)}.${summary.legalBalls % ballsPerOver}`,
    runRate: summary.legalBalls === 0 ? 0 : (summary.runsOffBat + extrasRuns) * ballsPerOver / summary.legalBalls,
  }
}

export function isInningsComplete(
  deliveries: readonly DeliveryEvent[],
  oversLimit: number,
  battingPlayers: number,
  ballsPerOver: number,
): boolean {
  if (!Number.isInteger(oversLimit) || oversLimit < 1) throw new Error('Overs limit must be a positive integer.')
  if (!Number.isInteger(battingPlayers) || battingPlayers < 2) throw new Error('A batting lineup must have at least two players.')
  const summary = summarizeInnings(deliveries, ballsPerOver)
  return summary.wickets >= battingPlayers - 1 || summary.legalBalls >= oversLimit * ballsPerOver
}

export function undoLastDelivery(deliveries: readonly DeliveryEvent[]): DeliveryEvent[] {
  return deliveries.slice(0, -1)
}

export function groupDeliveriesByOver(deliveries: readonly DeliveryEvent[], ballsPerOver: number): OverDeliveryBatch[] {
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
  let legalBalls = 0
  const overs: OverDeliveryBatch[] = []

  deliveries.forEach((delivery) => {
    validateDelivery(delivery)
    const overNumber = Math.floor(legalBalls / ballsPerOver) + 1
    const currentOver = overs.at(-1)
    if (currentOver?.overNumber !== overNumber) overs.push({ overNumber, deliveries: [] })
    overs.at(-1)!.deliveries.push(delivery)
    legalBalls += Number(delivery.legalBall)
  })

  return overs
}
