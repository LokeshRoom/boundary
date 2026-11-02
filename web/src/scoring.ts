import type { FixtureTeam } from './fixtures'

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
  dismissalType: DismissalType | null
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
  innings: 1 | 2
  overNumber: number
  deliveries: DeliveryEvent[]
}

export type InningsScorecard = {
  summary: InningsSummary
  batting: BatterSummary[]
  bowling: BowlerSummary[]
}

export type LiveMatchSnapshot = {
  currentInnings: 1 | 2
  scoreSummary: InningsSummary
  recentBalls: DeliveryEvent[]
}

export type PublicLiveMatchSummary = {
  tournamentId: string
  fixtureId: string
  stage: 'KNOCKOUT' | 'LEAGUE' | 'GROUP'
  roundName: string
  groupName?: string
  matchNumber: number
  teamA: FixtureTeam
  teamB: FixtureTeam
  snapshot: LiveMatchSnapshot
}

export function formatDeliveryLabel(delivery: DeliveryEvent): string {
  if (delivery.isWicket) return 'W'
  if (delivery.extrasType === 'WIDE') return delivery.completedRuns ? `WD+${delivery.completedRuns}` : 'WD'
  if (delivery.extrasType === 'NO_BALL') return delivery.runsOffBat ? `NB+${delivery.runsOffBat}` : 'NB'
  if (delivery.extrasType === 'BYE') return `${delivery.completedRuns + delivery.extrasRuns}B`
  if (delivery.extrasType === 'LEG_BYE') return `${delivery.completedRuns + delivery.extrasRuns}LB`
  return String(delivery.runsOffBat + (delivery.extrasType === 'PENALTY' ? delivery.extrasRuns : 0))
}

export function formatExtrasSummary(extras: InningsSummary['extras']): string {
  const labels: Array<[keyof InningsSummary['extras'], string]> = [
    ['WIDE', 'wides'],
    ['NO_BALL', 'no-balls'],
    ['BYE', 'byes'],
    ['LEG_BYE', 'leg-byes'],
    ['PENALTY', 'penalty'],
  ]
  const detail = labels.filter(([type]) => extras[type] > 0).map(([type, label]) => `${label} ${extras[type]}`).join(', ')
  const total = Object.values(extras).reduce((sum, runs) => sum + runs, 0)
  return detail ? `Extras ${total} (${detail})` : 'Extras 0'
}

export function parsePublicLiveMatchSummary(value: unknown, tournamentId: string, fixtureId: string, ballsPerOver: number): PublicLiveMatchSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved live match data is invalid.')
  const match = value as Record<string, unknown>
  const isText = (text: unknown): text is string => typeof text === 'string' && text.trim().length > 0
  const isTeam = (team: unknown): team is FixtureTeam => Boolean(team && typeof team === 'object' && !Array.isArray(team) && isText((team as Record<string, unknown>).id) && isText((team as Record<string, unknown>).name))
  if (match.tournamentId !== tournamentId || match.fixtureId !== fixtureId || !['KNOCKOUT', 'LEAGUE', 'GROUP'].includes(match.stage as string) || !isText(match.roundName) || !Number.isInteger(match.matchNumber) || (match.matchNumber as number) < 1 || !isTeam(match.teamA) || !isTeam(match.teamB) || (match.groupName !== undefined && !isText(match.groupName))) throw new Error('Saved live match data is invalid.')
  return {
    tournamentId,
    fixtureId,
    stage: match.stage as PublicLiveMatchSummary['stage'],
    roundName: match.roundName,
    ...(match.groupName ? { groupName: match.groupName as string } : {}),
    matchNumber: match.matchNumber as number,
    teamA: match.teamA,
    teamB: match.teamB,
    snapshot: parseLiveMatchSnapshot(match, ballsPerOver),
  }
}

export function parseLiveMatchSnapshot(value: unknown, ballsPerOver: number): LiveMatchSnapshot {
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved live match data is invalid.')
  const match = value as Record<string, unknown>
  if ((match.currentInnings !== 1 && match.currentInnings !== 2) || !Array.isArray(match.recentBalls) || match.recentBalls.length > 18) throw new Error('Saved live match data is invalid.')

  const summary = match.scoreSummary
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new Error('Saved live match data is invalid.')
  const score = summary as Record<string, unknown>
  const extras = score.extras
  const extraTypes: ExtrasType[] = ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) throw new Error('Saved live match data is invalid.')
  const extraRuns = extras as Record<string, unknown>
  if (Object.keys(extraRuns).length !== extraTypes.length || extraTypes.some((type) => !Number.isInteger(extraRuns[type]) || (extraRuns[type] as number) < 0)) throw new Error('Saved live match data is invalid.')

  const { runs, wickets, legalBalls, overs, runRate, runsOffBat } = score
  if (![runs, wickets, legalBalls, runsOffBat].every((number) => Number.isInteger(number) && (number as number) >= 0) || typeof overs !== 'string' || typeof runRate !== 'number' || !Number.isFinite(runRate) || runRate < 0) throw new Error('Saved live match data is invalid.')
  const totalExtras = extraTypes.reduce((total, type) => total + (extraRuns[type] as number), 0)
  if (runs !== (runsOffBat as number) + totalExtras || overs !== `${Math.floor((legalBalls as number) / ballsPerOver)}.${(legalBalls as number) % ballsPerOver}` || runRate !== ((legalBalls as number) === 0 ? 0 : (runs as number) * ballsPerOver / (legalBalls as number))) throw new Error('Saved live match totals are inconsistent.')

  summarizeInnings(match.recentBalls as DeliveryEvent[], ballsPerOver)
  return {
    currentInnings: match.currentInnings,
    scoreSummary: score as unknown as InningsSummary,
    recentBalls: match.recentBalls as DeliveryEvent[],
  }
}

export type BattingEnds = {
  strikerId: string
  nonStrikerId: string
}

function validateBattingEnds(ends: BattingEnds, ballsPerOver: number) {
  if (!ends.strikerId || !ends.nonStrikerId || ends.strikerId === ends.nonStrikerId) throw new Error('The striker and non-striker must be different players.')
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
}

const extrasTypes: ExtrasType[] = ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']

function validateDelivery(delivery: DeliveryEvent) {
  if (typeof delivery.strikerId !== 'string' || !delivery.strikerId.trim()) throw new Error('A striker ID is required for each delivery.')
  if (typeof delivery.bowlerId !== 'string' || !delivery.bowlerId.trim()) throw new Error('A bowler ID is required for each delivery.')
  if (!Number.isInteger(delivery.completedRuns) || delivery.completedRuns < 0) throw new Error('Completed runs must be a non-negative integer.')
  if (delivery.dismissedBatterId !== undefined && (typeof delivery.dismissedBatterId !== 'string' || !delivery.dismissedBatterId.trim())) throw new Error('A dismissed batter ID must be a non-empty string.')
  if (delivery.incomingBatterId !== undefined && (typeof delivery.incomingBatterId !== 'string' || !delivery.incomingBatterId.trim())) throw new Error('An incoming batter ID must be a non-empty string.')
  if (delivery.incomingBatterId && delivery.incomingBatterId === delivery.dismissedBatterId) throw new Error('The incoming batter must differ from the dismissed batter.')
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

export function makeNoBallDelivery(strikerId: string, bowlerId: string, runsOffBat: number): DeliveryEvent {
  if (![0, 1, 2, 3, 4, 6].includes(runsOffBat)) throw new Error('Choose a supported no-ball run value.')
  const delivery: DeliveryEvent = {
    strikerId,
    bowlerId,
    completedRuns: runsOffBat < 4 ? runsOffBat : 0,
    runsOffBat,
    extrasType: 'NO_BALL',
    extrasRuns: 1,
    legalBall: false,
    isWicket: false,
  }
  validateDelivery(delivery)
  return delivery
}

export function makeWideDelivery(strikerId: string, bowlerId: string, extrasRuns: number, completedRuns: number): DeliveryEvent {
  const validRuns = (completedRuns === 0 && [1, 5].includes(extrasRuns)) || (completedRuns > 0 && completedRuns <= 5 && extrasRuns === completedRuns + 1)
  if (!validRuns) throw new Error('Choose a valid wide result.')
  const delivery: DeliveryEvent = {
    strikerId,
    bowlerId,
    completedRuns,
    runsOffBat: 0,
    extrasType: 'WIDE',
    extrasRuns,
    legalBall: false,
    isWicket: false,
  }
  validateDelivery(delivery)
  return delivery
}

export function makeWicketDelivery(strikerId: string, bowlerId: string, dismissalType: DismissalType, incomingBatterId?: string): DeliveryEvent {
  if (incomingBatterId === strikerId) throw new Error('The incoming batter must differ from the dismissed batter.')
  const delivery: DeliveryEvent = {
    strikerId,
    bowlerId,
    completedRuns: 0,
    dismissedBatterId: strikerId,
    ...(incomingBatterId && { incomingBatterId }),
    dismissalType,
    runsOffBat: 0,
    extrasRuns: 0,
    legalBall: true,
    isWicket: true,
  }
  validateDelivery(delivery)
  return delivery
}

export function advanceBattingEnds(
  ends: BattingEnds,
  delivery: DeliveryEvent,
  legalBallsInOverBefore: number,
  ballsPerOver: number,
): BattingEnds {
  validateDelivery(delivery)
  validateBattingEnds(ends, ballsPerOver)
  if (!Number.isInteger(legalBallsInOverBefore) || legalBallsInOverBefore < 0 || legalBallsInOverBefore >= ballsPerOver) throw new Error('Legal balls in the current over are out of range.')
  if (delivery.strikerId !== ends.strikerId) throw new Error('The delivery striker must be at the striker end.')
  if (delivery.isWicket && (delivery.dismissedBatterId !== ends.strikerId || delivery.completedRuns !== 0 || delivery.runsOffBat !== 0)) throw new Error('A wicket in the preview must dismiss the striker without completed runs.')
  if (delivery.isWicket && delivery.incomingBatterId === delivery.dismissedBatterId) throw new Error('The incoming batter must differ from the dismissed batter.')
  if (delivery.isWicket && delivery.incomingBatterId && delivery.incomingBatterId === ends.nonStrikerId) throw new Error('The incoming batter must not already be at the crease.')
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

export function getBattingEndsAfter(deliveries: readonly DeliveryEvent[], openingEnds: BattingEnds, battingPlayers: number, ballsPerOver: number): BattingEnds {
  if (!Number.isInteger(battingPlayers) || battingPlayers < 2) throw new Error('A batting lineup must have at least two players.')
  validateBattingEnds(openingEnds, ballsPerOver)
  let ends = openingEnds
  let legalBallsInOver = 0
  const dismissedBatterIds = new Set<string>()
  deliveries.forEach((delivery) => {
    if (delivery.isWicket && delivery.dismissedBatterId && dismissedBatterIds.has(delivery.dismissedBatterId)) throw new Error('A batter cannot be dismissed more than once.')
    if (delivery.isWicket && delivery.incomingBatterId && dismissedBatterIds.has(delivery.incomingBatterId)) throw new Error('An already dismissed batter cannot return to the crease.')
    const wicketsAfterDelivery = dismissedBatterIds.size + Number(Boolean(delivery.dismissedBatterId))
    if (delivery.isWicket && !delivery.incomingBatterId && wicketsAfterDelivery < battingPlayers - 1) throw new Error('An incoming batter is required before the innings is all out.')
    if (delivery.isWicket && delivery.incomingBatterId && wicketsAfterDelivery >= battingPlayers - 1) throw new Error('The innings is all out and no incoming batter remains.')
    ends = advanceBattingEnds(ends, delivery, legalBallsInOver, ballsPerOver)
    if (delivery.dismissedBatterId) dismissedBatterIds.add(delivery.dismissedBatterId)
    legalBallsInOver = delivery.legalBall ? (legalBallsInOver + 1) % ballsPerOver : legalBallsInOver
  })
  return ends
}

export function summarizeBattingScorecard(deliveries: readonly DeliveryEvent[], batterIds: readonly string[]): BatterSummary[] {
  if (new Set(batterIds).size !== batterIds.length || batterIds.some((id) => !id.trim())) throw new Error('Batter IDs must be unique and non-empty.')
  const batters = new Map(batterIds.map((playerId) => [playerId, { playerId, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, dismissed: false, dismissalType: null as DismissalType | null, strikeRate: 0 }]))
  const dismissedBatterIds = new Set<string>()

  deliveries.forEach((delivery) => {
    validateDelivery(delivery)
    if (delivery.incomingBatterId && dismissedBatterIds.has(delivery.incomingBatterId)) throw new Error('An already dismissed batter cannot return to the crease.')
    const batter = batters.get(delivery.strikerId)
    if (!batter) throw new Error('Every striker must be included in the batting lineup.')
    batter.runs += delivery.runsOffBat
    if (delivery.extrasType !== 'WIDE') batter.ballsFaced += 1
    if (delivery.runsOffBat === 4) batter.fours += 1
    if (delivery.runsOffBat === 6) batter.sixes += 1
    if (delivery.dismissedBatterId) {
      const dismissed = batters.get(delivery.dismissedBatterId)
      if (!dismissed) throw new Error('The dismissed batter must be included in the batting lineup.')
      if (dismissedBatterIds.has(delivery.dismissedBatterId)) throw new Error('A batter cannot be dismissed more than once.')
      dismissed.dismissed = true
      dismissed.dismissalType = delivery.dismissalType!
      dismissedBatterIds.add(delivery.dismissedBatterId)
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

export function buildLiveMatchSnapshot(
  deliveries: readonly DeliveryEvent[],
  ballsPerOver: number,
  currentInnings: 1 | 2 = 1,
): LiveMatchSnapshot {
  if (currentInnings !== 1 && currentInnings !== 2) throw new Error('Current innings must be 1 or 2.')
  return {
    currentInnings,
    scoreSummary: summarizeInnings(deliveries, ballsPerOver),
    recentBalls: deliveries.slice(-18),
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

export function groupDeliveriesByOver(deliveries: readonly DeliveryEvent[], ballsPerOver: number, innings: 1 | 2 = 1): OverDeliveryBatch[] {
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
  if (innings !== 1 && innings !== 2) throw new Error('Innings must be 1 or 2.')
  let legalBalls = 0
  const overs: OverDeliveryBatch[] = []

  deliveries.forEach((delivery) => {
    validateDelivery(delivery)
    const overNumber = Math.floor(legalBalls / ballsPerOver) + 1
    const currentOver = overs.at(-1)
    if (currentOver?.overNumber !== overNumber) overs.push({ innings, overNumber, deliveries: [] })
    overs.at(-1)!.deliveries.push(delivery)
    legalBalls += Number(delivery.legalBall)
  })

  return overs
}

export function flattenOverBatches(batches: readonly OverDeliveryBatch[], ballsPerOver: number): DeliveryEvent[] {
  if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1) throw new Error('Balls per over must be a positive integer.')
  const innings = batches[0]?.innings ?? 1
  if ((innings !== 1 && innings !== 2) || batches.some((batch) => (batch.innings ?? 1) !== innings)) throw new Error('Over batches must belong to one valid innings.')

  return batches.flatMap((batch, index) => {
    if (batch.overNumber !== index + 1 || !Array.isArray(batch.deliveries) || batch.deliveries.length === 0) throw new Error('Over batches must be non-empty and numbered consecutively from 1.')
    batch.deliveries.forEach(validateDelivery)
    const legalBalls = batch.deliveries.reduce((total, delivery) => total + Number(delivery.legalBall), 0)
    if (legalBalls > ballsPerOver) throw new Error('An over batch cannot exceed its legal-ball limit.')
    if (index < batches.length - 1 && legalBalls !== ballsPerOver) throw new Error('Every non-final over batch must contain its full legal-ball limit.')
    return batch.deliveries
  })
}
