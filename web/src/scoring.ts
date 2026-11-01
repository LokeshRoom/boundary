export type ExtrasType = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY'

export type DeliveryEvent = {
  strikerId: string
  dismissedBatterId?: string
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

const extrasTypes: ExtrasType[] = ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']

function validateDelivery(delivery: DeliveryEvent) {
  if (typeof delivery.strikerId !== 'string' || !delivery.strikerId.trim()) throw new Error('A striker ID is required for each delivery.')
  if (delivery.dismissedBatterId !== undefined && (typeof delivery.dismissedBatterId !== 'string' || !delivery.dismissedBatterId.trim())) throw new Error('A dismissed batter ID must be a non-empty string.')
  if (delivery.isWicket !== Boolean(delivery.dismissedBatterId)) throw new Error('Wicket deliveries must identify the dismissed batter.')
  if (!Number.isInteger(delivery.runsOffBat) || delivery.runsOffBat < 0) throw new Error('Runs off the bat must be a non-negative integer.')
  if (!Number.isInteger(delivery.extrasRuns) || delivery.extrasRuns < 0) throw new Error('Extras must be a non-negative integer.')
  if (delivery.extrasRuns > 0 && !delivery.extrasType) throw new Error('Choose an extras type when extras are recorded.')
  if (delivery.extrasType && !extrasTypes.includes(delivery.extrasType)) throw new Error('Unknown extras type.')
  if (['WIDE', 'NO_BALL'].includes(delivery.extrasType ?? '') && delivery.legalBall) throw new Error('Wides and no-balls do not count as legal balls.')
  if (['WIDE', 'NO_BALL'].includes(delivery.extrasType ?? '') && delivery.extrasRuns < 1) throw new Error('Wides and no-balls must include at least one extra run.')
  if (typeof delivery.legalBall !== 'boolean' || typeof delivery.isWicket !== 'boolean') throw new Error('Delivery flags must be boolean values.')
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
  })

  return [...batters.values()].map((batter) => ({
    ...batter,
    strikeRate: batter.ballsFaced === 0 ? 0 : batter.runs * 100 / batter.ballsFaced,
  }))
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

export function undoLastDelivery(deliveries: readonly DeliveryEvent[]): DeliveryEvent[] {
  return deliveries.slice(0, -1)
}
