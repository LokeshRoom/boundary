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

export async function listTeams(tournamentId: string): Promise<Team[]> {
  const { firestore, collection, getDocs } = await getFirebaseFirestore()
  const result = await getDocs(collection(firestore, 'tournaments', tournamentId, 'teams'))
  return result.docs.map((snapshot) => ({ id: snapshot.id, name: snapshot.data().name, shortName: snapshot.data().shortName }))
}

export async function createTeam(tournamentId: string, team: NewTeam): Promise<Team> {
  const { firestore, collection, doc, serverTimestamp, writeBatch } = await getFirebaseFirestore()
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
  await batch.commit()

  return { id: teamRef.id, name: team.name, shortName: team.shortName }
}
