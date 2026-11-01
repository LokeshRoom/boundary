import { getFirebaseFirestore } from './firebase'

export type Team = {
  id: string
  name: string
  shortName: string
}

export type NewTeam = {
  name: string
  shortName: string
  captainName: string
  captainContact: string
}

export type PlayerRole = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER'

export type Player = {
  id: string
  name: string
  jerseyNumber: number
  role: PlayerRole
}

export type NewPlayer = Omit<Player, 'id'>

export type TeamRegistration = {
  teamName: string
  shortName: string
  captainName: string
  captainContact: string
  players: NewPlayer[]
}

export type PendingRegistration = {
  id: string
  teamName: string
  shortName: string
  captainName: string
  captainContact: string
}

export async function listTeams(tournamentId: string): Promise<Team[]> {
  const { firestore, collection, getDocs } = await getFirebaseFirestore()
  const result = await getDocs(collection(firestore, 'tournaments', tournamentId, 'teams'))
  return result.docs.map((snapshot) => ({ id: snapshot.id, name: snapshot.data().name, shortName: snapshot.data().shortName }))
}

export async function listPendingRegistrations(tournamentId: string): Promise<PendingRegistration[]> {
  const { firestore, collection, getDocs } = await getFirebaseFirestore()
  const result = await getDocs(collection(firestore, 'tournaments', tournamentId, 'pendingRegistrations'))
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as PendingRegistration)
}

export async function createTeam(tournamentId: string, team: NewTeam): Promise<Team> {
  const { firestore, collection, doc, increment, serverTimestamp, writeBatch } = await getFirebaseFirestore()
  const teamRef = doc(collection(firestore, 'tournaments', tournamentId, 'teams'))
  const batch = writeBatch(firestore)
  const createdAt = serverTimestamp()
  const updatedAt = serverTimestamp()

  batch.set(teamRef, {
    name: team.name,
    shortName: team.shortName,
    status: 'APPROVED',
    createdAt,
    updatedAt,
  })
  batch.set(doc(firestore, 'tournaments', tournamentId, 'privateRegistrations', teamRef.id), {
    captainName: team.captainName,
    captainContact: team.captainContact,
    createdAt,
    updatedAt,
  })
  batch.update(doc(firestore, 'tournaments', tournamentId), {
    teamCount: increment(1),
    updatedAt,
  })
  await batch.commit()

  return { id: teamRef.id, name: team.name, shortName: team.shortName }
}

export async function listPlayers(tournamentId: string, teamId: string): Promise<Player[]> {
  const { firestore, collection, getDocs } = await getFirebaseFirestore()
  const result = await getDocs(collection(firestore, 'tournaments', tournamentId, 'teams', teamId, 'players'))
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Player)
}

export async function addPlayer(tournamentId: string, teamId: string, player: NewPlayer): Promise<Player> {
  const { firestore, addDoc, collection } = await getFirebaseFirestore()
  const result = await addDoc(collection(firestore, 'tournaments', tournamentId, 'teams', teamId, 'players'), player)
  return { id: result.id, ...player }
}

export async function submitTeamRegistration(tournamentId: string, uid: string, registration: TeamRegistration) {
  const { firestore, collection, doc, serverTimestamp, writeBatch } = await getFirebaseFirestore()
  const registrationRef = doc(firestore, 'tournaments', tournamentId, 'pendingRegistrations', uid)
  const batch = writeBatch(firestore)
  batch.set(registrationRef, {
    teamName: registration.teamName,
    shortName: registration.shortName,
    captainName: registration.captainName,
    captainContact: registration.captainContact,
    submittedAt: serverTimestamp(),
  })
  for (const player of registration.players) {
    batch.set(doc(collection(registrationRef, 'players')), player)
  }
  await batch.commit()
}
