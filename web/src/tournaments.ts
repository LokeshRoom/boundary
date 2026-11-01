import { getFirebaseFirestore } from './firebase'
import type { GroupStageGroup, KnockoutRound, PlayableFixture, RoundRobinRound } from './fixtures'
import { flattenOverBatches, parseLiveMatchSnapshot, type LiveMatchSnapshot, type OverDeliveryBatch } from './scoring'

export type Format = 'Knockout' | 'League' | 'Groups + playoffs'
export type Status = 'Registration open' | 'Registration closed' | 'Upcoming' | 'Live' | 'Completed'

export type Tournament = {
  id?: string
  name: string
  format: Format
  teams: number
  status: Status
  registrationOpen: boolean
  note: string
  overs: number
  ballsPerOver: number
  powerplayOvers: number
  startDate?: string
  endDate?: string
  venue?: string
}

export type RegistrationTournament = {
  name: string
  venue: string
  startDate: string
  isOpen: boolean
}

function liveMatchDocumentId(tournamentId: string, fixtureId: string) {
  return `${tournamentId}_${fixtureId}`
}

export async function saveLiveMatchSnapshot(tournamentId: string, fixture: PlayableFixture, snapshot: LiveMatchSnapshot) {
  const { firestore, doc, runTransaction, serverTimestamp } = await getFirebaseFirestore()
  const matchRef = doc(firestore, 'matches', liveMatchDocumentId(tournamentId, fixture.id))

  await runTransaction(firestore, async (transaction) => {
    const currentMatch = await transaction.get(matchRef)
    const updated = {
      tournamentId,
      fixtureId: fixture.id,
      stage: fixture.stage,
      roundName: fixture.roundName,
      ...(fixture.groupName ? { groupName: fixture.groupName } : {}),
      matchNumber: fixture.matchNumber,
      teamA: fixture.teamA,
      teamB: fixture.teamB,
      currentInnings: snapshot.currentInnings,
      scoreSummary: snapshot.scoreSummary,
      recentBalls: snapshot.recentBalls,
      updatedAt: serverTimestamp(),
    }
    if (currentMatch.exists()) {
      transaction.update(matchRef, updated)
    } else {
      transaction.set(matchRef, { ...updated, createdAt: serverTimestamp() })
    }
  })
}

export async function getLiveMatchSnapshot(tournamentId: string, fixture: PlayableFixture, ballsPerOver: number): Promise<LiveMatchSnapshot | null> {
  const { firestore, doc, getDoc } = await getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, 'matches', liveMatchDocumentId(tournamentId, fixture.id)))
  if (!snapshot.exists()) return null

  const match = snapshot.data()
  if (match.tournamentId !== tournamentId || match.fixtureId !== fixture.id) {
    throw new Error('Saved live match data is invalid.')
  }
  return parseLiveMatchSnapshot(match, ballsPerOver)
}

export async function saveOverDeliveryBatch(tournamentId: string, fixture: PlayableFixture, overNumber: number, deliveries: OverDeliveryBatch['deliveries'] | null, ballsPerOver: number) {
  if (!Number.isInteger(overNumber) || overNumber < 1 || overNumber > 100) throw new Error('Over number must be between 1 and 100.')
  if (deliveries) flattenOverBatches([{ overNumber: 1, deliveries }], ballsPerOver)
  const { firestore, doc, runTransaction, serverTimestamp } = await getFirebaseFirestore()
  const overRef = doc(firestore, 'matches', liveMatchDocumentId(tournamentId, fixture.id), 'overs', String(overNumber))

  await runTransaction(firestore, async (transaction) => {
    const savedOver = await transaction.get(overRef)
    if (!deliveries) {
      if (savedOver.exists()) transaction.delete(overRef)
      return
    }

    const updated = { overNumber, deliveries, updatedAt: serverTimestamp() }
    if (savedOver.exists()) transaction.update(overRef, updated)
    else transaction.set(overRef, { ...updated, createdAt: serverTimestamp() })
  })
}

export async function getOverDeliveryBatches(tournamentId: string, fixture: PlayableFixture, ballsPerOver: number): Promise<OverDeliveryBatch[]> {
  const { firestore, collection, getDocs } = await getFirebaseFirestore()
  const oversRef = collection(firestore, 'matches', liveMatchDocumentId(tournamentId, fixture.id), 'overs')
  const savedOvers = await getDocs(oversRef)
  const batches = savedOvers.docs.map((saved) => saved.data() as OverDeliveryBatch).sort((left, right) => left.overNumber - right.overNumber)
  flattenOverBatches(batches, ballsPerOver)
  return batches
}

const firestoreFormats = {
  Knockout: 'KNOCKOUT',
  League: 'LEAGUE',
  'Groups + playoffs': 'GROUP_KNOCKOUT',
} as const

const formats: Record<string, Format> = {
  KNOCKOUT: 'Knockout',
  LEAGUE: 'League',
  GROUP_KNOCKOUT: 'Groups + playoffs',
}

const statuses: Record<string, Status> = {
  REGISTRATION: 'Registration open',
  UPCOMING: 'Upcoming',
  LIVE: 'Live',
  COMPLETED: 'Completed',
}

export async function saveTournament(ownerUid: string, tournament: Tournament) {
  const { firestore, addDoc, collection, serverTimestamp } = await getFirebaseFirestore()
  const result = await addDoc(collection(firestore, 'tournaments'), {
    name: tournament.name,
    format: firestoreFormats[tournament.format],
    status: 'REGISTRATION',
    organizerUid: ownerUid,
    oversPerInnings: tournament.overs,
    ballsPerOver: tournament.ballsPerOver,
    powerplayOvers: tournament.powerplayOvers,
    startDate: tournament.startDate,
    ...(tournament.endDate ? { endDate: tournament.endDate } : {}),
    venue: tournament.venue,
    registrationOpen: tournament.registrationOpen,
    teamCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return result.id
}

export async function listOwnedTournaments(ownerUid: string): Promise<Tournament[]> {
  const { firestore, collection, getDocs, query, where } = await getFirebaseFirestore()
  const result = await getDocs(query(collection(firestore, 'tournaments'), where('organizerUid', '==', ownerUid)))

  return result.docs.map((snapshot) => {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      name: data.name,
      format: formats[data.format] ?? 'Knockout',
      teams: data.teamCount ?? 0,
      status: data.status === 'REGISTRATION' && data.registrationOpen === false ? 'Registration closed' : statuses[data.status] ?? 'Upcoming',
      registrationOpen: data.registrationOpen === true,
      note: 'Saved to Firebase',
      overs: data.oversPerInnings,
      ballsPerOver: data.ballsPerOver,
      powerplayOvers: data.powerplayOvers,
      startDate: data.startDate,
      endDate: data.endDate,
      venue: data.venue,
    }
  })
}

export async function updateTournamentRegistration(tournamentId: string, registrationOpen: boolean) {
  const { firestore, doc, serverTimestamp, updateDoc } = await getFirebaseFirestore()
  await updateDoc(doc(firestore, 'tournaments', tournamentId), { registrationOpen, updatedAt: serverTimestamp() })
}

export async function getRegistrationTournament(tournamentId: string): Promise<RegistrationTournament | null> {
  const { firestore, doc, getDoc } = await getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, 'tournaments', tournamentId))
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    name: data.name,
    venue: data.venue,
    startDate: data.startDate,
    isOpen: data.status === 'REGISTRATION' && data.registrationOpen === true,
  }
}

export async function saveKnockoutFixtures(tournamentId: string, rounds: KnockoutRound[]) {
  const { firestore, doc, runTransaction, serverTimestamp } = await getFirebaseFirestore()
  const fixtureRef = doc(firestore, 'tournaments', tournamentId, 'fixtures', 'knockout')

  await runTransaction(firestore, async (transaction) => {
    const currentFixtures = await transaction.get(fixtureRef)
    if (currentFixtures.exists()) throw new Error('Fixtures already exist for this tournament.')

    transaction.set(fixtureRef, {
      format: 'KNOCKOUT',
      rounds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function getKnockoutFixtures(tournamentId: string): Promise<KnockoutRound[] | null> {
  const { firestore, doc, getDoc } = await getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, 'tournaments', tournamentId, 'fixtures', 'knockout'))
  if (!snapshot.exists()) return null

  const fixture = snapshot.data()
  if (fixture.format !== 'KNOCKOUT' || !Array.isArray(fixture.rounds)) throw new Error('Saved knockout fixtures have an invalid format.')
  return fixture.rounds as KnockoutRound[]
}

export async function saveRoundRobinFixtures(tournamentId: string, rounds: RoundRobinRound[]) {
  const { firestore, doc, runTransaction, serverTimestamp } = await getFirebaseFirestore()
  const fixtureRef = doc(firestore, 'tournaments', tournamentId, 'fixtures', 'league')

  await runTransaction(firestore, async (transaction) => {
    const currentFixtures = await transaction.get(fixtureRef)
    if (currentFixtures.exists()) throw new Error('Round-robin fixtures already exist for this tournament.')

    transaction.set(fixtureRef, {
      format: 'ROUND_ROBIN',
      rounds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function getRoundRobinFixtures(tournamentId: string): Promise<RoundRobinRound[] | null> {
  const { firestore, doc, getDoc } = await getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, 'tournaments', tournamentId, 'fixtures', 'league'))
  if (!snapshot.exists()) return null

  const fixture = snapshot.data()
  if (fixture.format !== 'ROUND_ROBIN' || !Array.isArray(fixture.rounds)) throw new Error('Saved league fixtures have an invalid format.')
  return fixture.rounds as RoundRobinRound[]
}

export async function saveGroupStageFixtures(tournamentId: string, groups: GroupStageGroup[]) {
  const { firestore, doc, runTransaction, serverTimestamp } = await getFirebaseFirestore()
  const fixtureRef = doc(firestore, 'tournaments', tournamentId, 'fixtures', 'groups')

  await runTransaction(firestore, async (transaction) => {
    const currentFixtures = await transaction.get(fixtureRef)
    if (currentFixtures.exists()) throw new Error('Group-stage fixtures already exist for this tournament.')

    transaction.set(fixtureRef, {
      format: 'GROUP_STAGE',
      groups,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function getGroupStageFixtures(tournamentId: string): Promise<GroupStageGroup[] | null> {
  const { firestore, doc, getDoc } = await getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, 'tournaments', tournamentId, 'fixtures', 'groups'))
  if (!snapshot.exists()) return null

  const fixture = snapshot.data()
  if (fixture.format !== 'GROUP_STAGE' || !Array.isArray(fixture.groups)) throw new Error('Saved group-stage fixtures have an invalid format.')
  return fixture.groups as GroupStageGroup[]
}
