export type ExtrasType = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY'

export type DeliveryEvent = {
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

const extrasTypes: ExtrasType[] = ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']

function validateDelivery(delivery: DeliveryEvent) {
  if (!Number.isInteger(delivery.runsOffBat) || delivery.runsOffBat < 0) throw new Error('Runs off the bat must be a non-negative integer.')
  if (!Number.isInteger(delivery.extrasRuns) || delivery.extrasRuns < 0) throw new Error('Extras must be a non-negative integer.')
  if (delivery.extrasRuns > 0 && !delivery.extrasType) throw new Error('Choose an extras type when extras are recorded.')
  if (delivery.extrasType && !extrasTypes.includes(delivery.extrasType)) throw new Error('Unknown extras type.')
  if (['WIDE', 'NO_BALL'].includes(delivery.extrasType ?? '') && delivery.legalBall) throw new Error('Wides and no-balls do not count as legal balls.')
  if (['WIDE', 'NO_BALL'].includes(delivery.extrasType ?? '') && delivery.extrasRuns < 1) throw new Error('Wides and no-balls must include at least one extra run.')
  if (typeof delivery.legalBall !== 'boolean' || typeof delivery.isWicket !== 'boolean') throw new Error('Delivery flags must be boolean values.')
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
