import { useEffect, useState, type FormEvent } from 'react'
import { getFirebaseAuth, isFirebaseAppCheckConfigured, isFirebaseConfigured } from './firebase'
import { submitTeamRegistration, type NewPlayer, type PlayerRole } from './teams'
import { getRegistrationTournament, type RegistrationTournament } from './tournaments'
import './App.css'
import './RegistrationPage.css'

type PlayerDraft = {
  name: string
  jerseyNumber: number | ''
  role: PlayerRole
}

const emptyPlayer: PlayerDraft = { name: '', jerseyNumber: '', role: 'BATTER' }

export default function RegistrationPage({ tournamentId }: { tournamentId: string }) {
  const [tournament, setTournament] = useState<RegistrationTournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<PlayerDraft[]>([{ ...emptyPlayer }])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!isFirebaseConfigured) return () => { active = false }

    void getRegistrationTournament(tournamentId).then((result) => {
      if (active) setTournament(result)
    }).catch(() => {
      if (active) setError('Could not load this tournament. Check the link and try again.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [tournamentId])

  function updatePlayer(index: number, update: Partial<PlayerDraft>) {
    setPlayers((current) => current.map((player, playerIndex) => playerIndex === index ? { ...player, ...update } : player))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tournament?.isOpen || !isFirebaseConfigured || !isFirebaseAppCheckConfigured) return

    const form = new FormData(event.currentTarget)
    const registrationPlayers: NewPlayer[] = players.map((player) => ({
      name: player.name.trim(),
      jerseyNumber: Number(player.jerseyNumber),
      role: player.role,
    }))
    const registration = {
      teamName: String(form.get('teamName') ?? '').trim(),
      shortName: String(form.get('shortName') ?? '').trim().toUpperCase(),
      captainName: String(form.get('captainName') ?? '').trim(),
      captainContact: String(form.get('captainContact') ?? '').trim(),
      players: registrationPlayers,
    }
    if (!registration.teamName || !registration.shortName || !registration.captainName || registration.captainContact.length < 5) return
    if (players.length < 1 || players.length > 30 || registrationPlayers.some((player) => !player.name || !Number.isInteger(player.jerseyNumber) || player.jerseyNumber < 0 || player.jerseyNumber > 99)) return

    setSubmitting(true)
    setError('')
    void getFirebaseAuth().then(async ({ auth, signInAnonymously }) => {
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user
      await submitTeamRegistration(tournamentId, user.uid, registration)
    }).then(() => setSubmitted(true)).catch(() => {
      setError('Could not submit. Confirm Anonymous sign-in is enabled and that registration is still open. A browser can submit only once per tournament.')
    }).finally(() => setSubmitting(false))
  }

  const isLoading = isFirebaseConfigured && loading
  const pageError = !isFirebaseConfigured
    ? 'This tournament registration page is not connected to Firebase yet.'
    : !isFirebaseAppCheckConfigured
      ? 'Public registration requires Firebase App Check. Add the reCAPTCHA site key and enable App Check enforcement in Firebase.'
      : error

  return (
    <main className="registration-shell">
      <header className="registration-brand"><span className="brand-mark"><span /><span /><span /></span><span>boundary<span className="brand-dot">.</span></span></header>
      <section className="registration-card">
        <span className="eyebrow">Team registration</span>
        <h1>{isLoading ? 'Loading tournament...' : tournament?.name ?? 'Tournament not found'}</h1>
        {tournament && <p className="registration-context">{tournament.venue} · {tournament.startDate}</p>}
        {submitted ? <div className="registration-success" role="status"><strong>Registration submitted</strong><p>The organizer will review your team and contact the captain.</p></div> : isLoading ? <p className="form-note">Please wait while we load the registration details.</p> : !isFirebaseConfigured || !isFirebaseAppCheckConfigured ? <p className="registration-closed">{pageError}</p> : !tournament?.isOpen ? <p className="registration-closed">{tournament ? 'Registration is closed for this tournament.' : pageError || 'Tournament not found.'}</p> : <form className="registration-form" onSubmit={submit}>
          <label className="field-label" htmlFor="registration-team-name">Team name</label>
          <input id="registration-team-name" name="teamName" required maxLength={60} />
          <label className="field-label" htmlFor="registration-short-name">Short name</label>
          <input id="registration-short-name" name="shortName" required maxLength={5} />
          <label className="field-label" htmlFor="registration-captain-name">Captain name</label>
          <input id="registration-captain-name" name="captainName" required maxLength={80} />
          <label className="field-label" htmlFor="registration-captain-contact">Captain contact</label>
          <input id="registration-captain-contact" name="captainContact" required minLength={5} maxLength={120} />
          <div className="registration-roster-heading"><h2>Players</h2><button className="roster-action" type="button" disabled={players.length >= 30} onClick={() => setPlayers((current) => [...current, { ...emptyPlayer }])}>Add player</button></div>
          <div className="registration-roster">
            {players.map((player, index) => <fieldset className="registration-player" key={index}>
              <legend>Player {index + 1}</legend>
              <label className="field-label" htmlFor={`registration-player-name-${index}`}>Name</label>
              <input id={`registration-player-name-${index}`} value={player.name} required maxLength={60} onChange={(event) => updatePlayer(index, { name: event.currentTarget.value })} />
              <label className="field-label" htmlFor={`registration-player-number-${index}`}>Jersey number</label>
              <input id={`registration-player-number-${index}`} type="number" min="0" max="99" value={player.jerseyNumber} required onChange={(event) => updatePlayer(index, { jerseyNumber: event.currentTarget.value === '' ? '' : Number(event.currentTarget.value) })} />
              <label className="field-label" htmlFor={`registration-player-role-${index}`}>Role</label>
              <select id={`registration-player-role-${index}`} value={player.role} onChange={(event) => updatePlayer(index, { role: event.currentTarget.value as PlayerRole })}><option value="BATTER">Batter</option><option value="BOWLER">Bowler</option><option value="ALL_ROUNDER">All-rounder</option><option value="WICKETKEEPER">Wicketkeeper</option></select>
              {players.length > 1 && <button className="roster-action remove-player" type="button" onClick={() => setPlayers((current) => current.filter((_, playerIndex) => playerIndex !== index))}>Remove player</button>}
            </fieldset>)}
          </div>
          <p className="form-note">Captain contact details are private and visible only to the tournament organizer. Team details and player names appear after approval.</p>
          {error && <p className="team-error" role="status">{error}</p>}
          <button className="button button-primary registration-submit" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit for review'}</button>
        </form>}
      </section>
    </main>
  )
}
