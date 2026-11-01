import { getFirebaseFirestore } from './firebase'
import type { KnockoutRound } from './fixtures'

export type Format = 'Knockout' | 'League' | 'Groups + playoffs'
export type Status = 'Registration open' | 'Upcoming' | 'Live' | 'Completed'

export type Tournament = {
  id?: string
  name: string
  format: Format
  teams: number
  status: Status
  note: string
  overs: number
  ballsPerOver: number
  powerplayOvers: number
  startDate?: string
  endDate?: string
  venue?: string
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
    registrationOpen: true,
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
      status: statuses[data.status] ?? 'Upcoming',
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
