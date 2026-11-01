import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { getFirebaseAuth, isFirebaseConfigured } from './firebase'
import { generateGroupStage, generateKnockoutRounds, generateRoundRobinRounds, listPlayableFixtures, ROUND_ROBIN_TEAM_LIMIT, type FixtureEntrant, type GroupStageGroup, type KnockoutRound, type PlayableFixture, type RoundRobinRound } from './fixtures'
import { buildLiveMatchSnapshot, flattenOverBatches, getBattingEndsAfter, groupDeliveriesByOver, isInningsComplete, summarizeBattingScorecard, summarizeBowlingScorecard, summarizeInnings, undoLastDelivery, type DeliveryEvent } from './scoring'
import { addPlayer, approveTeamRegistration, createTeam, listPendingRegistrations, listPlayers, listTeams, rejectTeamRegistration, type NewPlayer, type NewTeam, type PendingRegistration, type Player, type PlayerRole, type Team } from './teams'
import { getGroupStageFixtures, getKnockoutFixtures, getLiveMatchSnapshot, getOverDeliveryBatches, getRoundRobinFixtures, listOwnedTournaments, saveGroupStageFixtures, saveKnockoutFixtures, saveLiveMatchSnapshot, saveOverDeliveryBatch, saveRoundRobinFixtures, saveTournament, updateTournamentRegistration, type Format, type Status, type Tournament } from './tournaments'
import './App.css'

const initialTournaments: Tournament[] = [
  { name: 'Riverside Summer Cup', format: 'Knockout', teams: 12, status: 'Registration open', registrationOpen: true, note: '4 spots left', overs: 20, ballsPerOver: 6, powerplayOvers: 6, venue: 'Riverside Ground', startDate: '2026-06-14' },
  { name: 'Sunday Turf League', format: 'League', teams: 8, status: 'Live', registrationOpen: false, note: '2nd innings', overs: 12, ballsPerOver: 6, powerplayOvers: 4, venue: 'Central Turf', startDate: '2026-05-03' },
  { name: 'Northside Club Series', format: 'Groups + playoffs', teams: 16, status: 'Completed', registrationOpen: false, note: 'Winner: Cedar CC', overs: 20, ballsPerOver: 6, powerplayOvers: 6, venue: 'Northside Oval', startDate: '2026-03-22' },
]

const navItems = [
  { label: 'Overview', href: '#overview', icon: 'home' },
  { label: 'Tournaments', href: '#tournaments', icon: 'cup' },
  { label: 'Live score', href: '#live-score', icon: 'score' },
]

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
    cup: 'M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4m-4 3v4m-5 2h10',
    score: 'M4 4v16h16M7 15l4-4 3 2 5-6',
    plus: 'M12 5v14m-7-7h14',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    close: 'm6 6 12 12M18 6 6 18',
    check: 'm5 12 4 4L19 6',
    ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-5.7 2 4 3m6.9-3-4 3m6 8-5 .2m-9-.2 5 .2m.5 4.7.7-4.8m4.8 4.8-.7-4.8',
  }

  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={paths[name] ?? paths.ball} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
}

function sameInningsSummary(left: ReturnType<typeof summarizeInnings>, right: ReturnType<typeof summarizeInnings>) {
  return left.runs === right.runs
    && left.wickets === right.wickets
    && left.legalBalls === right.legalBalls
    && left.overs === right.overs
    && left.runRate === right.runRate
    && left.runsOffBat === right.runsOffBat
    && Object.keys(left.extras).every((type) => left.extras[type as keyof typeof left.extras] === right.extras[type as keyof typeof right.extras])
}

function TournamentDialog({
  dialogRef,
  onCreate,
  canSave,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  onCreate: (tournament: Tournament) => Promise<boolean>
  canSave: boolean
}) {
  const [submitting, setSubmitting] = useState(false)
  const [overs, setOvers] = useState(20)
  const [powerplayOvers, setPowerplayOvers] = useState(6)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const formElement = event.currentTarget
    const name = String(form.get('name') ?? '').trim()
    const overs = Number(form.get('overs'))
    const startDate = String(form.get('startDate') ?? '')
    const endDate = String(form.get('endDate') ?? '')
    const venue = String(form.get('venue') ?? '').trim()
    const ballsPerOver = Number(form.get('ballsPerOver'))
    const powerplayOvers = Number(form.get('powerplayOvers'))
    if (!name || !venue || !startDate || !Number.isInteger(overs) || overs < 1 || overs > 100) return
    if (!Number.isInteger(ballsPerOver) || ballsPerOver < 1 || ballsPerOver > 12 || !Number.isInteger(powerplayOvers) || powerplayOvers < 0 || powerplayOvers > overs) return
    const endDateInput = formElement.elements.namedItem('endDate') as HTMLInputElement
    if (endDate && endDate < startDate) {
      endDateInput.setCustomValidity('End date must be on or after the start date.')
      endDateInput.reportValidity()
      return
    }
    endDateInput.setCustomValidity('')

    setSubmitting(true)
    void onCreate({ name, format: form.get('format') as Format, teams: 0, status: 'Registration open', registrationOpen: true, note: 'Preview only', overs, ballsPerOver, powerplayOvers, startDate, endDate: endDate || undefined, venue })
      .then((saved) => {
        if (!saved) return
        formElement.reset()
        setOvers(20)
        setPowerplayOvers(6)
        dialogRef.current?.close()
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <dialog className="create-dialog" ref={dialogRef} aria-labelledby="create-title">
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">New tournament</span>
            <h2 id="create-title">Set up your next cup</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
            <Icon name="close" />
          </button>
        </div>
        <label className="field-label" htmlFor="tournament-name">Tournament name</label>
        <input autoFocus id="tournament-name" name="name" placeholder="e.g. Riverside Summer Cup" required maxLength={60} />
        <label className="field-label" htmlFor="tournament-format">Format</label>
        <select id="tournament-format" name="format" defaultValue="Knockout">
          <option>Knockout</option>
          <option>League</option>
          <option>Groups + playoffs</option>
        </select>
        <label className="field-label" htmlFor="tournament-start-date">Start date</label>
        <input id="tournament-start-date" name="startDate" type="date" required />
        <label className="field-label" htmlFor="tournament-end-date">End date <span>(optional)</span></label>
        <input id="tournament-end-date" name="endDate" type="date" onChange={(event) => event.currentTarget.setCustomValidity('')} />
        <label className="field-label" htmlFor="tournament-venue">Venue</label>
        <input id="tournament-venue" name="venue" placeholder="e.g. Riverside Ground" required maxLength={100} />
        <label className="field-label" htmlFor="tournament-overs">Overs per innings</label>
        <input id="tournament-overs" name="overs" type="number" min="1" max="100" value={overs} onChange={(event) => {
          const nextOvers = Number(event.currentTarget.value)
          setOvers(nextOvers)
          setPowerplayOvers((current) => Math.min(current, nextOvers))
        }} required />
        <label className="field-label" htmlFor="tournament-balls-per-over">Balls per over</label>
        <input id="tournament-balls-per-over" name="ballsPerOver" type="number" min="1" max="12" defaultValue="6" required />
        <label className="field-label" htmlFor="tournament-powerplay-overs">Powerplay overs</label>
        <input id="tournament-powerplay-overs" name="powerplayOvers" type="number" min="0" max={overs} value={powerplayOvers} onChange={(event) => setPowerplayOvers(Number(event.currentTarget.value))} required />
        <p className="form-note">{canSave ? 'This tournament will be saved to your Firebase account.' : 'Preview only. Sign in with Firebase configured to save tournaments.'}</p>
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : canSave ? 'Create tournament' : 'Add to preview'} <Icon name="arrow" size={16} /></button>
        </div>
      </form>
    </dialog>
  )
}

function TeamDialog({
  dialogRef,
  tournament,
  canManage,
  onTeamAdded,
  onRegistrationChanged,
  onSelectFixture,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  tournament: Tournament | null
  canManage: boolean
  onTeamAdded: (tournamentId: string, teamCount: number) => void
  onRegistrationChanged: (tournamentId: string, registrationOpen: boolean) => void
  onSelectFixture: (fixture: PlayableFixture, tournament: Tournament) => void
}) {
  const [teams, setTeams] = useState<Team[]>([])
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [teamsTournamentId, setTeamsTournamentId] = useState<string | null>(null)
  const [activeTeam, setActiveTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [bracketTournamentId, setBracketTournamentId] = useState<string | null>(null)
  const [savedBracketTournamentId, setSavedBracketTournamentId] = useState<string | null>(null)
  const [savedBracketRounds, setSavedBracketRounds] = useState<KnockoutRound[] | null>(null)
  const [loadingBracket, setLoadingBracket] = useState(false)
  const [leagueScheduleTournamentId, setLeagueScheduleTournamentId] = useState<string | null>(null)
  const [groupStageTournamentId, setGroupStageTournamentId] = useState<string | null>(null)
  const [groupCount, setGroupCount] = useState(2)
  const [savedGroupStageTournamentId, setSavedGroupStageTournamentId] = useState<string | null>(null)
  const [savedGroups, setSavedGroups] = useState<GroupStageGroup[] | null>(null)
  const [loadingGroupStage, setLoadingGroupStage] = useState(false)
  const [savingGroupStage, setSavingGroupStage] = useState(false)
  const [groupStageMessage, setGroupStageMessage] = useState('')
  const [groupStageMessageTournamentId, setGroupStageMessageTournamentId] = useState<string | null>(null)
  const [savedLeagueScheduleTournamentId, setSavedLeagueScheduleTournamentId] = useState<string | null>(null)
  const [savedLeagueRounds, setSavedLeagueRounds] = useState<RoundRobinRound[] | null>(null)
  const [loadingLeagueSchedule, setLoadingLeagueSchedule] = useState(false)
  const [savingLeagueSchedule, setSavingLeagueSchedule] = useState(false)
  const [leagueScheduleMessage, setLeagueScheduleMessage] = useState('')
  const [leagueScheduleMessageTournamentId, setLeagueScheduleMessageTournamentId] = useState<string | null>(null)
  const [savingBracket, setSavingBracket] = useState(false)
  const [bracketMessage, setBracketMessage] = useState('')
  const [bracketMessageTournamentId, setBracketMessageTournamentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [linkCopyMessage, setLinkCopyMessage] = useState('')
  const [registrationSaving, setRegistrationSaving] = useState(false)
  const loading = Boolean(tournament?.id && teamsTournamentId !== tournament.id)

  useEffect(() => {
    if (!tournament?.id) return

    let active = true
    const tournamentId = tournament.id
    void Promise.all([listTeams(tournamentId), listPendingRegistrations(tournamentId)]).then(([saved, pending]) => {
      if (active) {
        setTeams(saved)
        setPendingRegistrations(pending)
        setTeamsTournamentId(tournamentId)
        setError('')
      }
    }).catch(() => {
      if (active) {
        setTeams([])
        setPendingRegistrations([])
        setTeamsTournamentId(tournamentId)
        setError('Could not load teams. Check your Firestore rules and connection.')
      }
    })
    return () => { active = false }
  }, [tournament?.id])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tournament?.id || !canManage) return

    const formElement = event.currentTarget
    const tournamentId = tournament.id
    const form = new FormData(formElement)
    const team: NewTeam = {
      name: String(form.get('teamName') ?? '').trim(),
      shortName: String(form.get('shortName') ?? '').trim().toUpperCase(),
      captainName: String(form.get('captainName') ?? '').trim(),
      captainContact: String(form.get('captainContact') ?? '').trim(),
    }
    if (!team.name || !team.shortName || !team.captainName || team.captainContact.length < 5) return

    setSubmitting(true)
    setError('')
    void createTeam(tournamentId, team).then((created) => {
      const updatedTeams = [...teams, created]
      setTeams(updatedTeams)
      onTeamAdded(tournamentId, updatedTeams.length)
      formElement.reset()
    }).catch(() => {
      setError('Could not save this team. Check your Firestore connection and rules.')
    }).finally(() => setSubmitting(false))
  }

  function openRoster(team: Team) {
    if (!tournament?.id) return
    setActiveTeam(team)
    setPlayers([])
    setPlayersLoading(true)
    setError('')
    void listPlayers(tournament.id, team.id).then(setPlayers).catch(() => {
      setError('Could not load this roster. Check your Firestore rules and connection.')
    }).finally(() => setPlayersLoading(false))
  }

  function approveRegistration(registration: PendingRegistration) {
    if (!tournament?.id || !canManage) return
    const tournamentId = tournament.id
    setSubmitting(true)
    setError('')
    void approveTeamRegistration(tournamentId, registration.id).then((team) => {
      setPendingRegistrations((current) => current.filter((pending) => pending.id !== registration.id))
      const updatedTeams = [...teams, team]
      setTeams(updatedTeams)
      onTeamAdded(tournamentId, updatedTeams.length)
    }).catch(() => {
      setError('Could not approve this registration. It may already have been handled, or Firestore rules may need an update.')
    }).finally(() => setSubmitting(false))
  }

  function rejectRegistration(registration: PendingRegistration) {
    if (!tournament?.id || !canManage || !window.confirm(`Reject ${registration.teamName}'s registration?`)) return
    const tournamentId = tournament.id
    setSubmitting(true)
    setError('')
    void rejectTeamRegistration(tournamentId, registration.id).then(() => {
      setPendingRegistrations((current) => current.filter((pending) => pending.id !== registration.id))
    }).catch(() => {
      setError('Could not reject this registration. It may already have been handled, or Firestore rules may need an update.')
    }).finally(() => setSubmitting(false))
  }

  function toggleBracket() {
    if (!tournament?.id) return
    if (showBracket) {
      setBracketTournamentId(null)
      return
    }

    const tournamentId = tournament.id
    setBracketTournamentId(tournamentId)
    setLoadingBracket(true)
    setBracketMessage('')
    void getKnockoutFixtures(tournamentId).then((saved) => {
      setSavedBracketTournamentId(tournamentId)
      setSavedBracketRounds(saved)
      if (saved) setBracketMessage('Saved bracket loaded.')
    }).catch(() => {
      setSavedBracketTournamentId(tournamentId)
      setSavedBracketRounds(null)
      setBracketMessage('Could not load the saved bracket. Check Firestore rules and connection.')
    }).finally(() => {
      setBracketMessageTournamentId(tournamentId)
      setLoadingBracket(false)
    })
  }

  function toggleLeagueSchedule() {
    if (!tournament?.id) return
    if (showLeagueSchedule) {
      setLeagueScheduleTournamentId(null)
      return
    }

    const tournamentId = tournament.id
    setLeagueScheduleTournamentId(tournamentId)
    setLoadingLeagueSchedule(true)
    setLeagueScheduleMessage('')
    void getRoundRobinFixtures(tournamentId).then((saved) => {
      setSavedLeagueScheduleTournamentId(tournamentId)
      setSavedLeagueRounds(saved)
      if (saved) setLeagueScheduleMessage('Saved schedule loaded.')
    }).catch(() => {
      setSavedLeagueScheduleTournamentId(tournamentId)
      setSavedLeagueRounds(null)
      setLeagueScheduleMessage('Could not load the saved schedule. Check Firestore rules and connection.')
    }).finally(() => {
      setLeagueScheduleMessageTournamentId(tournamentId)
      setLoadingLeagueSchedule(false)
    })
  }

  function toggleGroupStage() {
    if (!tournament?.id) return
    if (showGroupStage) {
      setGroupStageTournamentId(null)
      return
    }

    const tournamentId = tournament.id
    setGroupStageTournamentId(tournamentId)
    setLoadingGroupStage(true)
    setGroupStageMessage('')
    void getGroupStageFixtures(tournamentId).then((saved) => {
      setSavedGroupStageTournamentId(tournamentId)
      setSavedGroups(saved)
      if (saved) {
        setGroupCount(saved.length)
        setGroupStageMessage('Saved group-stage fixtures loaded.')
      }
    }).catch(() => {
      setSavedGroupStageTournamentId(tournamentId)
      setSavedGroups(null)
      setGroupStageMessage('Could not load saved group-stage fixtures. Check Firestore rules and connection.')
    }).finally(() => {
      setGroupStageMessageTournamentId(tournamentId)
      setLoadingGroupStage(false)
    })
  }

  function toggleRegistration() {
    if (!tournament?.id || !canManage || !['Registration open', 'Registration closed'].includes(tournament.status)) return
    const registrationOpen = !tournament.registrationOpen
    setRegistrationSaving(true)
    setError('')
    void updateTournamentRegistration(tournament.id, registrationOpen).then(() => {
      onRegistrationChanged(tournament.id!, registrationOpen)
    }).catch(() => {
      setError('Could not update registration. Check your Firestore connection and rules.')
    }).finally(() => setRegistrationSaving(false))
  }

  function copyRegistrationLink() {
    if (!tournament?.id) return
    const link = `${window.location.origin}/t/${tournament.id}/register`
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(link).then(() => setLinkCopyMessage('Registration link copied.')).catch(() => setLinkCopyMessage('Copy the link from the field.'))
      return
    }
    const input = document.getElementById('registration-link') as HTMLInputElement | null
    input?.select()
    setLinkCopyMessage('Select and copy the link from the field.')
  }

  function submitPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tournament?.id || !activeTeam || !canManage) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const player: NewPlayer = {
      name: String(form.get('playerName') ?? '').trim(),
      jerseyNumber: Number(form.get('jerseyNumber')),
      role: form.get('playerRole') as PlayerRole,
    }
    if (!player.name || !Number.isInteger(player.jerseyNumber) || player.jerseyNumber < 0 || player.jerseyNumber > 99) return

    setSubmitting(true)
    setError('')
    void addPlayer(tournament.id, activeTeam.id, player).then((created) => {
      setPlayers((current) => [...current, created])
      formElement.reset()
    }).catch(() => {
      setError('Could not add this player. Check your Firestore connection and rules.')
    }).finally(() => setSubmitting(false))
  }

  function entrantLabel(entrant: FixtureEntrant) {
    return entrant.type === 'team' ? entrant.team.name : `Winner of match ${entrant.matchNumber}`
  }

  async function saveBracket() {
    if (!tournament?.id || !canManage || knockoutRounds.length === 0) return
    setSavingBracket(true)
    setBracketMessage('')
    try {
      await saveKnockoutFixtures(tournament.id, knockoutRounds)
      setSavedBracketTournamentId(tournament.id)
      setSavedBracketRounds(knockoutRounds)
      setBracketMessage('Bracket saved. A saved bracket cannot be replaced yet.')
    } catch {
      setBracketMessage('Could not save the bracket. It may already exist, or Firestore rules may need an update.')
    } finally {
      setBracketMessageTournamentId(tournament.id)
      setSavingBracket(false)
    }
  }

  async function saveLeagueSchedule() {
    if (!tournament?.id || !canManage || leagueRounds.length === 0) return
    setSavingLeagueSchedule(true)
    setLeagueScheduleMessage('')
    try {
      await saveRoundRobinFixtures(tournament.id, leagueRounds)
      setSavedLeagueScheduleTournamentId(tournament.id)
      setSavedLeagueRounds(leagueRounds)
      setLeagueScheduleMessage('Schedule saved. A saved schedule cannot be replaced yet.')
    } catch {
      setLeagueScheduleMessage('Could not save the schedule. It may already exist, or Firestore rules may need an update.')
    } finally {
      setLeagueScheduleMessageTournamentId(tournament.id)
      setSavingLeagueSchedule(false)
    }
  }

  async function saveGroupStage() {
    if (!tournament?.id || !canManage || groups.length === 0) return
    setSavingGroupStage(true)
    setGroupStageMessage('')
    try {
      await saveGroupStageFixtures(tournament.id, groups)
      setSavedGroupStageTournamentId(tournament.id)
      setSavedGroups(groups)
      setGroupStageMessage('Group-stage fixtures saved. A saved schedule cannot be replaced yet.')
    } catch {
      setGroupStageMessage('Could not save the group-stage fixtures. They may already exist, or Firestore rules may need an update.')
    } finally {
      setGroupStageMessageTournamentId(tournament.id)
      setSavingGroupStage(false)
    }
  }

  const showBracket = bracketTournamentId === tournament?.id
  const showLeagueSchedule = leagueScheduleTournamentId === tournament?.id
  const showGroupStage = groupStageTournamentId === tournament?.id
  const hasSavedBracket = savedBracketTournamentId === tournament?.id && savedBracketRounds !== null
  const hasSavedLeagueSchedule = savedLeagueScheduleTournamentId === tournament?.id && savedLeagueRounds !== null
  const hasSavedGroupStage = savedGroupStageTournamentId === tournament?.id && savedGroups !== null
  const maximumGroupCount = Math.floor(teams.length / 2)
  const selectedGroupCount = Math.max(2, Math.min(groupCount, maximumGroupCount))
  const knockoutRounds = showBracket && !loading && !loadingBracket && tournament?.format === 'Knockout' && teams.length >= 2
    ? hasSavedBracket ? savedBracketRounds ?? [] : generateKnockoutRounds(teams)
    : []
  const leagueRounds = showLeagueSchedule && !loading && !loadingLeagueSchedule && tournament?.format === 'League' && teams.length >= 2 && teams.length <= ROUND_ROBIN_TEAM_LIMIT
    ? hasSavedLeagueSchedule ? savedLeagueRounds : generateRoundRobinRounds(teams)
    : []
  const groups: GroupStageGroup[] = showGroupStage && !loading && !loadingGroupStage && tournament?.format === 'Groups + playoffs' && teams.length >= 4 && teams.length <= ROUND_ROBIN_TEAM_LIMIT
    ? hasSavedGroupStage ? savedGroups ?? [] : generateGroupStage(teams, selectedGroupCount)
    : []
  const playableFixtures = listPlayableFixtures(
    hasSavedBracket ? savedBracketRounds ?? [] : [],
    hasSavedLeagueSchedule ? savedLeagueRounds ?? [] : [],
    hasSavedGroupStage ? savedGroups ?? [] : [],
  )

  return (
    <dialog className="create-dialog" ref={dialogRef} aria-labelledby="teams-title">
      <div className="dialog-form">
        <div className="dialog-heading">
          <div><span className="eyebrow">Tournament teams</span><h2 id="teams-title">{tournament?.name ?? 'Choose a tournament'}</h2></div>
          <button className="icon-button" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}><Icon name="close" /></button>
        </div>
        {tournament?.id && canManage && <div className="registration-link-box">
          <label className="field-label" htmlFor="registration-link">Public registration link</label>
          <div className="registration-link-row"><input id="registration-link" readOnly value={`${window.location.origin}/t/${tournament.id}/register`} /><button className="roster-action" type="button" onClick={copyRegistrationLink}>Copy</button></div>
          {linkCopyMessage && <p className="form-note" role="status">{linkCopyMessage}</p>}
          {['Registration open', 'Registration closed'].includes(tournament.status) && <button className="roster-action" type="button" disabled={registrationSaving} onClick={toggleRegistration}>{registrationSaving ? 'Saving...' : tournament.registrationOpen ? 'Close registration' : 'Open registration'}</button>}
        </div>}
        {!tournament?.id || !canManage ? <p className="form-note">Save this tournament and sign in as its organizer to manage teams.</p> : <>
          <section className="pending-registrations" aria-labelledby="pending-registrations-title">
            <h3 id="pending-registrations-title">Pending registrations</h3>
            {loading ? <p className="form-note">Loading submissions...</p> : pendingRegistrations.length ? pendingRegistrations.map((registration) => <article className="pending-registration" key={registration.id}>
              <div><strong>{registration.teamName}</strong><span>{registration.shortName}</span></div>
              <p>{registration.captainName} · {registration.captainContact}</p>
              <ul>{registration.players.map((player, index) => <li key={`${player.name}-${index}`}>{player.name} · #{player.jerseyNumber} · {player.role.replaceAll('_', ' ')}</li>)}</ul>
              <div className="pending-actions">
                <button className="roster-action" type="button" disabled={submitting} onClick={() => approveRegistration(registration)}>{submitting ? 'Saving...' : 'Approve team'}</button>
                <button className="roster-action pending-reject" type="button" disabled={submitting} onClick={() => rejectRegistration(registration)}>Reject</button>
              </div>
            </article>) : <p className="form-note">No pending registrations.</p>}
          </section>
          <div className="team-list" aria-live="polite">
            {loading ? <p className="form-note">Loading teams...</p> : teams.length ? teams.map((team) => <div className="team-list-row" key={team.id}><strong>{team.name}</strong><span>{team.shortName}</span><button className="roster-action" type="button" disabled={playersLoading} onClick={() => openRoster(team)}>Manage roster</button></div>) : <p className="form-note">No teams added yet.</p>}
          </div>
          {tournament?.format === 'Knockout' && <button className="text-action bracket-toggle" type="button" disabled={loading || loadingBracket || teams.length < 2} onClick={toggleBracket}>{showBracket ? 'Hide bracket preview' : 'Preview knockout bracket'}</button>}
          {tournament?.format === 'League' && <button className="text-action bracket-toggle" type="button" disabled={loading || loadingLeagueSchedule || teams.length < 2 || teams.length > ROUND_ROBIN_TEAM_LIMIT} onClick={toggleLeagueSchedule}>{showLeagueSchedule ? 'Hide schedule preview' : 'Preview round-robin schedule'}</button>}
          {tournament?.format === 'League' && teams.length > ROUND_ROBIN_TEAM_LIMIT && <p className="form-note">Round-robin schedules support up to {ROUND_ROBIN_TEAM_LIMIT} teams.</p>}
          {tournament?.format === 'Groups + playoffs' && <>
            <label className="field-label" htmlFor="group-count">Number of groups</label>
            <select id="group-count" value={hasSavedGroupStage ? savedGroups?.length ?? selectedGroupCount : selectedGroupCount} disabled={hasSavedGroupStage} onChange={(event) => setGroupCount(Number(event.currentTarget.value))}>
              {Array.from({ length: Math.max(0, maximumGroupCount - 1) }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} groups</option>)}
            </select>
            {teams.length < 4 ? <p className="form-note">Add at least four teams to preview group-stage fixtures.</p> : teams.length > ROUND_ROBIN_TEAM_LIMIT ? <p className="form-note">Group-stage schedules support up to {ROUND_ROBIN_TEAM_LIMIT} teams.</p> : <button className="text-action bracket-toggle" type="button" disabled={loading || loadingGroupStage} onClick={toggleGroupStage}>{showGroupStage ? 'Hide group-stage preview' : 'Preview group-stage fixtures'}</button>}
          </>}
          {knockoutRounds.length > 0 && <section aria-label="Knockout bracket preview">
            <p className="form-note">{hasSavedBracket ? 'Saved bracket. Byes go to teams in the listed order.' : 'Preview only. Byes go to teams in the listed order.'}</p>
            <div className="bracket-preview">
            {knockoutRounds.map((round) => <div className="bracket-round" key={round.name}>
              <h3>{round.name}</h3>
              {round.matches.map((match) => <div className="bracket-match" key={match.number}>
                <span>{entrantLabel(match.teamA)}</span>
                {match.bye ? <small>Bye - advances</small> : <span>{match.teamB ? entrantLabel(match.teamB) : ''}</span>}
              </div>)}
            </div>)}
            </div>
            {!hasSavedBracket && <div className="bracket-save">
              <button className="button button-primary" type="button" disabled={savingBracket} onClick={saveBracket}>{savingBracket ? 'Saving...' : 'Save bracket'} <Icon name="arrow" size={16} /></button>
            </div>}
            {bracketMessageTournamentId === tournament.id && bracketMessage && <p className="form-note" role="status">{bracketMessage}</p>}
          </section>}
          {leagueRounds.length > 0 && <section className="league-schedule" aria-label="Round-robin schedule preview">
            <p className="form-note">{hasSavedLeagueSchedule ? 'Saved schedule · each team plays every other team once.' : 'Preview only · each team plays every other team once.'}</p>
            {leagueRounds.map((round) => <details className="league-round" key={round.name}>
              <summary>{round.name}<span>{round.matches.length} fixtures</span></summary>
              <div className="league-fixtures">{round.matches.map((match, index) => <div className="league-fixture" key={`${round.name}-${index}`}><strong>{match.teamA.name}</strong><span>{match.bye ? 'Bye' : 'vs'}</span>{match.teamB && <strong>{match.teamB.name}</strong>}</div>)}</div>
            </details>)}
            {!hasSavedLeagueSchedule && <div className="bracket-save">
              <button className="button button-primary" type="button" disabled={savingLeagueSchedule} onClick={saveLeagueSchedule}>{savingLeagueSchedule ? 'Saving...' : 'Save schedule'} <Icon name="arrow" size={16} /></button>
            </div>}
            {leagueScheduleMessageTournamentId === tournament.id && leagueScheduleMessage && <p className="form-note" role="status">{leagueScheduleMessage}</p>}
          </section>}
          {groups.length > 0 && <section className="league-schedule" aria-label="Group-stage schedule preview">
            <p className="form-note">{hasSavedGroupStage ? 'Saved fixtures · teams are balanced across groups in the listed order.' : 'Preview only · teams are balanced across groups in the listed order.'}</p>
            {groups.map((group) => <details className="league-round" key={group.name}>
              <summary>{group.name}<span>{group.teams.length} teams</span></summary>
              <div className="league-fixtures"><p className="form-note">{group.teams.map((team) => team.name).join(' · ')}</p>
                {group.rounds.map((round) => <details className="league-round" key={round.name}>
                  <summary>{round.name}<span>{round.matches.length} fixtures</span></summary>
                  <div className="league-fixtures">{round.matches.map((match, index) => <div className="league-fixture" key={`${round.name}-${index}`}><strong>{match.teamA.name}</strong><span>{match.bye ? 'Bye' : 'vs'}</span>{match.teamB && <strong>{match.teamB.name}</strong>}</div>)}</div>
                </details>)}
              </div>
            </details>)}
            {!hasSavedGroupStage && <div className="bracket-save">
              <button className="button button-primary" type="button" disabled={savingGroupStage} onClick={saveGroupStage}>{savingGroupStage ? 'Saving...' : 'Save group fixtures'} <Icon name="arrow" size={16} /></button>
            </div>}
            {groupStageMessageTournamentId === tournament.id && groupStageMessage && <p className="form-note" role="status">{groupStageMessage}</p>}
          </section>}
          {playableFixtures.length > 0 && <section className="league-schedule" aria-label="Matches ready to score">
            <h3>Matches ready to score</h3>
            <div className="league-fixtures">{playableFixtures.map((fixture) => <div className="league-fixture" key={fixture.id}>
              <strong>{fixture.teamA.name}</strong><span>vs</span><strong>{fixture.teamB.name}</strong>
              <button className="roster-action" type="button" onClick={() => {
                if (!tournament) return
                onSelectFixture(fixture, tournament)
                dialogRef.current?.close()
              }}>Score preview</button>
            </div>)}</div>
          </section>}
          {showLeagueSchedule && loadingLeagueSchedule && <p className="form-note" role="status">Checking for a saved schedule...</p>}
          {showBracket && loadingBracket && <p className="form-note" role="status">Checking for a saved bracket...</p>}
          {showGroupStage && loadingGroupStage && <p className="form-note" role="status">Checking for saved group-stage fixtures...</p>}
          {activeTeam && <section className="roster-panel" aria-labelledby="roster-title">
            <div className="roster-heading"><h3 id="roster-title">{activeTeam.name} roster</h3><button className="roster-action" type="button" onClick={() => setActiveTeam(null)}>All teams</button></div>
            <div className="player-list" aria-live="polite">
              {playersLoading ? <p className="form-note">Loading roster...</p> : players.length ? players.map((player) => <div className="team-list-row" key={player.id}><strong>{player.name}</strong><span>#{player.jerseyNumber} / {player.role.replaceAll('_', ' ')}</span></div>) : <p className="form-note">No players added yet.</p>}
            </div>
            <form className="team-create-form" onSubmit={submitPlayer}>
              <label className="field-label" htmlFor="player-name">Player name</label>
              <input id="player-name" name="playerName" required maxLength={60} />
              <label className="field-label" htmlFor="player-jersey">Jersey number</label>
              <input id="player-jersey" name="jerseyNumber" type="number" min="0" max="99" required />
              <label className="field-label" htmlFor="player-role">Role</label>
              <select id="player-role" name="playerRole" defaultValue="BATTER"><option value="BATTER">Batter</option><option value="BOWLER">Bowler</option><option value="ALL_ROUNDER">All-rounder</option><option value="WICKETKEEPER">Wicketkeeper</option></select>
              {error && <p className="team-error" role="status">{error}</p>}
              <div className="dialog-actions"><button className="button button-primary" type="submit" disabled={submitting || playersLoading}>{submitting ? 'Saving...' : 'Add player'} <Icon name="arrow" size={16} /></button></div>
            </form>
          </section>}
          {!activeTeam && <form className="team-create-form" onSubmit={submit}>
            <label className="field-label" htmlFor="team-name">Team name</label>
            <input id="team-name" name="teamName" required maxLength={60} placeholder="e.g. Cedar Cricket Club" />
            <label className="field-label" htmlFor="team-short-name">Short name</label>
            <input id="team-short-name" name="shortName" required maxLength={5} placeholder="e.g. CCC" />
            <label className="field-label" htmlFor="captain-name">Captain name</label>
            <input id="captain-name" name="captainName" required maxLength={80} />
            <label className="field-label" htmlFor="captain-contact">Captain contact</label>
            <input id="captain-contact" name="captainContact" required minLength={5} maxLength={120} />
            <p className="form-note">Captain contact details are saved in a private organizer-only record.</p>
            {error && <p className="team-error" role="status">{error}</p>}
            <div className="dialog-actions"><button className="button button-primary" type="submit" disabled={submitting || loading}>{submitting ? 'Saving...' : 'Add team'} <Icon name="arrow" size={16} /></button></div>
          </form>}
        </>}
        {error && (!canManage || !tournament?.id) && <p className="team-error" role="status">{error}</p>}
      </div>
    </dialog>
  )
}

function App() {
  const [tournaments, setTournaments] = useState(initialTournaments)
  const [previewDeliveries, setPreviewDeliveries] = useState<DeliveryEvent[]>([])
  const [previewMatch, setPreviewMatch] = useState<{ tournamentId?: string; tournamentName: string; oversLimit: number; ballsPerOver: number; fixture: PlayableFixture } | null>(null)
  const [loadedMatchKey, setLoadedMatchKey] = useState<string | null>(null)
  const [scoreSaveStatus, setScoreSaveStatus] = useState('')
  const [organizer, setOrganizer] = useState<string | null>(null)
  const [organizerUid, setOrganizerUid] = useState<string | null>(null)
  const [loadedOrganizerUid, setLoadedOrganizerUid] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const teamDialogRef = useRef<HTMLDialogElement>(null)
  const lastPersistedMatchRef = useRef<{ key: string; deliveries: string; overCount: number } | null>(null)
  const scoreSaveQueueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!isFirebaseConfigured) return

    let active = true
    let unsubscribe: (() => void) | undefined
    void getFirebaseAuth().then(({ auth, onAuthStateChanged }) => {
      if (!active) return
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setOrganizer(user?.displayName || user?.email || null)
        setLoadedMatchKey(null)
        setScoreSaveStatus('')
        setOrganizerUid(user?.uid ?? null)
        setAuthReady(true)
      })
    }).catch(() => {
      if (active) {
        setAuthError('Could not connect to Firebase Authentication. Check your web settings.')
        setAuthReady(true)
      }
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!organizerUid) return

    let active = true
    void listOwnedTournaments(organizerUid).then((saved) => {
      if (active) {
        setTournaments(saved)
        setLoadedOrganizerUid(organizerUid)
      }
    }).catch(() => {
      if (active) {
        setTournaments([])
        setAuthError('Could not load your tournaments from Firestore. Check your database rules.')
        setLoadedOrganizerUid(organizerUid)
      }
    })

    return () => { active = false }
  }, [organizerUid])

  const previewMatchKey = previewMatch?.tournamentId ? `${previewMatch.tournamentId}_${previewMatch.fixture.id}` : null
  const currentPreviewScoreRef = useRef<{ key: string | null; deliveries: string } | null>(null)

  useEffect(() => {
    const match = previewMatch
    if (!previewMatchKey || !match?.tournamentId || !organizerUid) return

    let active = true
    const load = scoreSaveQueueRef.current.then(() => Promise.all([
      getOverDeliveryBatches(match.tournamentId!, match.fixture, match.ballsPerOver),
      getLiveMatchSnapshot(match.tournamentId!, match.fixture, match.ballsPerOver),
    ]))
    void load.then(([batches, snapshot]) => {
      if (!active) return
      const deliveries = flattenOverBatches(batches, match.ballsPerOver)
      if (snapshot && !sameInningsSummary(snapshot.scoreSummary, buildLiveMatchSnapshot(deliveries, match.ballsPerOver).scoreSummary)) {
        throw new Error('Saved score does not match its delivery history.')
      }
      lastPersistedMatchRef.current = { key: previewMatchKey, deliveries: snapshot ? JSON.stringify(deliveries) : '', overCount: batches.length }
      currentPreviewScoreRef.current = { key: previewMatchKey, deliveries: JSON.stringify(deliveries) }
      setPreviewDeliveries(deliveries)
      setLoadedMatchKey(previewMatchKey)
      setScoreSaveStatus('Saved score loaded')
    }).catch(() => {
      if (active) setScoreSaveStatus('Could not load saved score. Check Firestore rules and connection.')
    })

    return () => { active = false }
  }, [organizerUid, previewMatch, previewMatchKey])

  const loadingTournaments = Boolean(organizerUid && loadedOrganizerUid !== organizerUid)
  const visibleTournaments = organizerUid ? tournaments : initialTournaments
  const previewBallsPerOver = previewMatch?.ballsPerOver ?? 6
  const previewOversLimit = previewMatch?.oversLimit ?? 20
  const previewScore = summarizeInnings(previewDeliveries, previewBallsPerOver)
  const previewTeamA = previewMatch?.fixture.teamA
  const previewTeamB = previewMatch?.fixture.teamB
  const previewOpeningEnds = { strikerId: 'preview-batter-a', nonStrikerId: 'preview-batter-b' }
  const previewLineup = [
    { id: 'preview-batter-a', name: 'M. Patel' },
    { id: 'preview-batter-b', name: 'J. Cole' },
    { id: 'preview-batter-c', name: 'S. Khan' },
    { id: 'preview-batter-d', name: 'A. Reed' },
  ]
  const previewEnds = getBattingEndsAfter(previewDeliveries, previewOpeningEnds, previewBallsPerOver)
  const previewBatters = summarizeBattingScorecard(previewDeliveries, previewLineup.map(({ id }) => id))
  const previewBowlers = summarizeBowlingScorecard(previewDeliveries, ['preview-bowler'], previewBallsPerOver)
  const previewStriker = previewBatters.find((batter) => batter.playerId === previewEnds.strikerId)!
  const previewNonStriker = previewBatters.find((batter) => batter.playerId === previewEnds.nonStrikerId)!
  const previewDismissed = new Set(previewBatters.filter((batter) => batter.dismissed).map((batter) => batter.playerId))
  const previewIncoming = previewLineup.find(({ id }) => id !== previewEnds.strikerId && id !== previewEnds.nonStrikerId && !previewDismissed.has(id))
  const previewInningsOver = isInningsComplete(previewDeliveries, previewOversLimit, previewLineup.length, previewBallsPerOver)
  const previewCanRecordWicket = !previewInningsOver && (Boolean(previewIncoming) || previewScore.wickets === previewLineup.length - 2)
  const previewMatchLoading = Boolean(organizerUid && previewMatchKey && loadedMatchKey !== previewMatchKey)

  useEffect(() => {
    if (!previewMatch?.tournamentId || !previewMatchKey || !organizerUid || loadedMatchKey !== previewMatchKey) return
    const deliveries = previewDeliveries
    const deliveriesJson = JSON.stringify(deliveries)
    const savedMatch = lastPersistedMatchRef.current
    if (savedMatch?.key === previewMatchKey && savedMatch.deliveries === deliveriesJson) return

    const batches = groupDeliveriesByOver(deliveries, previewMatch.ballsPerOver)
    setScoreSaveStatus('Saving score...')
    const save = scoreSaveQueueRef.current.then(async () => {
      await saveLiveMatchSnapshot(previewMatch.tournamentId!, previewMatch.fixture, buildLiveMatchSnapshot(deliveries, previewMatch.ballsPerOver))
      const previousOverCount = lastPersistedMatchRef.current?.key === previewMatchKey ? lastPersistedMatchRef.current.overCount : 0
      const currentOverCount = batches.length
      if (currentOverCount > 0) {
        const lastOver = batches[currentOverCount - 1]
        await saveOverDeliveryBatch(previewMatch.tournamentId!, previewMatch.fixture, lastOver.overNumber, lastOver.deliveries, previewMatch.ballsPerOver)
      }
      for (let overNumber = previousOverCount; overNumber > currentOverCount; overNumber -= 1) {
        await saveOverDeliveryBatch(previewMatch.tournamentId!, previewMatch.fixture, overNumber, null, previewMatch.ballsPerOver)
      }
      lastPersistedMatchRef.current = { key: previewMatchKey, deliveries: deliveriesJson, overCount: currentOverCount }
    })
    scoreSaveQueueRef.current = save.catch(() => {})
    void save.then(() => {
      if (currentPreviewScoreRef.current?.key === previewMatchKey && currentPreviewScoreRef.current.deliveries === deliveriesJson) setScoreSaveStatus('Score saved')
    }).catch(() => {
      if (currentPreviewScoreRef.current?.key === previewMatchKey) setScoreSaveStatus('Could not save score. Check Firestore rules and connection.')
    })
  }, [loadedMatchKey, organizerUid, previewDeliveries, previewMatch, previewMatchKey])

  function recordPreviewDelivery(delivery: DeliveryEvent) {
    const next = [...previewDeliveries, delivery]
    currentPreviewScoreRef.current = { key: previewMatchKey, deliveries: JSON.stringify(next) }
    setPreviewDeliveries(next)
  }

  function undoPreviewDelivery() {
    const next = undoLastDelivery(previewDeliveries)
    currentPreviewScoreRef.current = { key: previewMatchKey, deliveries: JSON.stringify(next) }
    setPreviewDeliveries(next)
  }

  function recordPreviewRuns(runsOffBat: number) {
    recordPreviewDelivery({ strikerId: previewEnds.strikerId, bowlerId: 'preview-bowler', completedRuns: runsOffBat < 4 ? runsOffBat : 0, runsOffBat, extrasRuns: 0, legalBall: true, isWicket: false })
  }

  function recordPreviewExtra(extrasType: 'WIDE' | 'NO_BALL') {
    recordPreviewDelivery({ strikerId: previewEnds.strikerId, bowlerId: 'preview-bowler', completedRuns: 0, runsOffBat: 0, extrasType, extrasRuns: 1, legalBall: false, isWicket: false })
  }

  function recordPreviewWicket() {
    if (!previewCanRecordWicket) return
    recordPreviewDelivery({ strikerId: previewEnds.strikerId, bowlerId: 'preview-bowler', completedRuns: 0, dismissedBatterId: previewEnds.strikerId, dismissalType: 'BOWLED', ...(previewIncoming && { incomingBatterId: previewIncoming.id }), runsOffBat: 0, extrasRuns: 0, legalBall: true, isWicket: true })
  }

  async function signIn() {
    setAuthBusy(true)
    setAuthError('')
    try {
      const { auth, GoogleAuthProvider, signInWithPopup } = await getFirebaseAuth()
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch {
      setAuthError('Sign-in failed. Check that Google is enabled in Firebase Authentication and this domain is authorized.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    setAuthBusy(true)
    setAuthError('')
    try {
      const { auth, signOut: firebaseSignOut } = await getFirebaseAuth()
      await firebaseSignOut(auth)
    } catch {
      setAuthError('Could not sign out. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function addTournament(tournament: Tournament): Promise<boolean> {
    if (!organizerUid) {
      setTournaments((current) => [tournament, ...current])
      return true
    }

    try {
      const id = await saveTournament(organizerUid, tournament)
      setTournaments((current) => [{ ...tournament, id, note: 'Saved to Firebase' }, ...current])
      setLoadedOrganizerUid(organizerUid)
      setAuthError('')
      return true
    } catch {
      setAuthError('Could not save this tournament. Check your Firebase connection and Firestore rules.')
      return false
    }
  }

  function openTeams(tournament: Tournament) {
    setSelectedTournament(tournament)
    teamDialogRef.current?.showModal()
  }

  function updateTeamCount(tournamentId: string, teamCount: number) {
    setTournaments((current) => current.map((tournament) => tournament.id === tournamentId ? { ...tournament, teams: teamCount } : tournament))
  }

  function updateRegistrationState(tournamentId: string, registrationOpen: boolean) {
    const status = registrationOpen ? 'Registration open' : 'Registration closed'
    setTournaments((current) => current.map((tournament) => tournament.id === tournamentId ? { ...tournament, registrationOpen, status } : tournament))
    setSelectedTournament((current) => current?.id === tournamentId ? { ...current, registrationOpen, status } : current)
  }

  return (
    <div className="app-frame" id="overview">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#overview" aria-label="Boundary home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>boundary<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">TOURNAMENT DESK</div>
        <nav className="side-nav">
          {navItems.map((item, index) => (
            <a key={item.label} className={`nav-link${index === 0 ? ' nav-active' : ''}`} href={item.href} aria-current={index === 0 ? 'page' : undefined}>
              <Icon name={item.icon} />{item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="connection-card">
          <span className="connection-dot" />
          <div><strong>{organizer ? 'Organizer account' : isFirebaseConfigured ? 'Firebase configured' : 'Preview workspace'}</strong><small>{organizer ? 'Signed in' : isFirebaseConfigured ? 'Sign in to save tournaments' : 'Add Firebase settings to connect'}</small></div>
        </div>
        <div className="sidebar-foot">A clearer view of match day.</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><span /><span /><span /></span>boundary<span className="brand-dot">.</span></div>
          <span className="top-date">Season dashboard</span>
          {isFirebaseConfigured && (organizer ? (
            <div className="auth-actions"><span className="auth-user">{organizer}</span><button className="button button-outline auth-button" type="button" onClick={signOut} disabled={authBusy}>{authBusy ? 'Please wait' : 'Sign out'}</button></div>
          ) : (
            <button className="button button-outline auth-button" type="button" onClick={signIn} disabled={!authReady || authBusy}>{authBusy ? 'Please wait' : 'Sign in with Google'}</button>
          ))}
          <button className="button button-primary top-create" type="button" onClick={() => dialogRef.current?.showModal()}>
            <Icon name="plus" size={17} /><span>New tournament</span>
          </button>
        </header>
        {authError && <p className="auth-error" role="status">{authError}</p>}

        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <span className="eyebrow">Your season</span>
              <h1>Cricket, <em>in good order.</em></h1>
              <p>One home for your tournaments, teams, and match days.</p>
            </div>
            <span className="preview-tag">Sample workspace</span>
          </section>

          <section className="overview-grid" aria-label="Season overview">
            <article className="live-card" id="live-score">
              <div className="live-card-top">
                <span className="live-label"><span className="pulse-dot" /> SCORING PREVIEW</span>
                <span className="match-series">{previewMatch ? `${previewMatch.tournamentName} · ${previewMatch.fixture.groupName ? `${previewMatch.fixture.groupName} · ` : ''}${previewMatch.fixture.roundName}` : 'Sunday Turf League · Sample match'}</span>
              </div>
              <div className="live-scoreline">
                <div className="team-block">
                  <span className="team-crest crest-cedar">{previewTeamA ? previewTeamA.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase() : 'CC'}</span>
                  <div><strong>{previewTeamA?.name ?? 'Cedar CC'}</strong><small>Batting</small></div>
                </div>
                <div className="score-block"><strong>{previewScore.runs}<span>/{previewScore.wickets}</span></strong><small>{previewScore.overs} overs · {previewScore.runRate.toFixed(2)} RPO</small></div>
                <span className="versus">V</span>
                <div className="team-block team-away">
                  <span className="team-crest crest-ridge">{previewTeamB ? previewTeamB.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase() : 'RC'}</span>
                  <div><strong>{previewTeamB?.name ?? 'Ridge Club'}</strong><small>Opponent</small></div>
                </div>
              </div>
              <div className="live-card-bottom">
                {previewInningsOver ? <div className="current-batters"><span>INNINGS</span><strong>ALL OUT · {previewScore.runs}/{previewScore.wickets}</strong></div> : <div className="current-batters"><span>BATTERS</span><strong>{previewLineup.find(({ id }) => id === previewEnds.strikerId)?.name}* <b>{previewStriker.runs}</b> <small>({previewStriker.ballsFaced})</small></strong><strong>{previewLineup.find(({ id }) => id === previewEnds.nonStrikerId)?.name} <b>{previewNonStriker.runs}</b> <small>({previewNonStriker.ballsFaced})</small></strong></div>}
                <div className="run-rate"><span>LEGAL BALLS</span><strong>{previewScore.legalBalls}</strong></div>
              </div>
              <div className="ball-strip" aria-label={`Recent deliveries: ${previewDeliveries.slice(-8).map((delivery) => delivery.isWicket ? 'wicket' : delivery.extrasType === 'WIDE' ? 'wide' : delivery.extrasType === 'NO_BALL' ? 'no-ball' : delivery.runsOffBat || 'dot').join(', ')}`}>
                <span>RECENT BALLS</span>{previewDeliveries.slice(-8).length ? previewDeliveries.slice(-8).map((delivery, index) => <b className={delivery.isWicket ? 'ball-wicket' : delivery.extrasType ? 'ball-extra' : delivery.runsOffBat === 4 || delivery.runsOffBat === 6 ? 'ball-boundary' : delivery.runsOffBat === 0 ? 'ball-dot' : undefined} key={`${previewDeliveries.length}-${index}`}>{delivery.isWicket ? 'W' : delivery.extrasType === 'WIDE' ? 'WD' : delivery.extrasType === 'NO_BALL' ? 'NB' : delivery.runsOffBat || '·'}</b>) : <small>No deliveries yet</small>}
              </div>
              {previewMatch?.tournamentId && <a className="public-score-link" href={`/t/${encodeURIComponent(previewMatch.tournamentId)}/match/${encodeURIComponent(previewMatch.fixture.id)}`} target="_blank" rel="noreferrer">Open public scoreboard ↗</a>}
              <details className="preview-scorecard">
                <summary><span>INNINGS SCORECARD</span><strong>{previewScore.runs}/{previewScore.wickets} <small>· {previewScore.overs} ov</small></strong></summary>
                <div className="preview-scorecard-scroll">
                  <table>
                    <caption>Batting</caption>
                    <thead><tr><th scope="col">Batter</th><th scope="col">R</th><th scope="col">B</th><th scope="col">4s</th><th scope="col">6s</th><th scope="col">SR</th></tr></thead>
                    <tbody>{previewBatters.map((batter) => <tr key={batter.playerId}><th scope="row">{previewLineup.find(({ id }) => id === batter.playerId)?.name}{batter.dismissed ? '' : previewEnds.strikerId === batter.playerId ? '*' : ''}</th><td>{batter.runs}</td><td>{batter.ballsFaced}</td><td>{batter.fours}</td><td>{batter.sixes}</td><td>{batter.strikeRate.toFixed(1)}</td></tr>)}</tbody>
                  </table>
                  <table>
                    <caption>Bowling</caption>
                    <thead><tr><th scope="col">Bowler</th><th scope="col">O</th><th scope="col">R</th><th scope="col">W</th><th scope="col">Econ</th></tr></thead>
                    <tbody>{previewBowlers.map((bowler) => <tr key={bowler.playerId}><th scope="row">L. Morris</th><td>{bowler.overs}</td><td>{bowler.runsConceded}</td><td>{bowler.wickets}</td><td>{bowler.economy.toFixed(1)}</td></tr>)}</tbody>
                  </table>
                </div>
              </details>
              <div className="scoring-preview" aria-label="Sample scoring controls">
                <span>ADD DELIVERY</span>
                <div className="scoring-keypad">{[0, 1, 2, 3, 4, 6].map((runs) => <button className="score-key" key={runs} type="button" disabled={previewInningsOver || previewMatchLoading} aria-label={`Record ${runs} runs`} onClick={() => recordPreviewRuns(runs)}>{runs}</button>)}
                  <button className="score-key score-key-extra" type="button" disabled={previewInningsOver || previewMatchLoading} onClick={() => recordPreviewExtra('WIDE')}>WD</button>
                  <button className="score-key score-key-extra" type="button" disabled={previewInningsOver || previewMatchLoading} onClick={() => recordPreviewExtra('NO_BALL')}>NB</button>
                  <button className="score-key score-key-extra" type="button" disabled={!previewCanRecordWicket || previewMatchLoading} onClick={recordPreviewWicket}>Wicket</button>
                  <button className="score-key score-key-undo" type="button" disabled={!previewDeliveries.length || previewMatchLoading} onClick={undoPreviewDelivery}>Undo last</button>
                </div>
                <small role={scoreSaveStatus || previewMatchLoading ? 'status' : undefined}>{scoreSaveStatus || (previewMatchLoading ? 'Loading saved score...' : previewInningsOver ? 'Sample innings complete' : previewMatchKey && organizerUid ? 'Score syncs to Firebase as you enter deliveries.' : 'Preview only · score resets when the page reloads.')}</small>
              </div>
            </article>

            <aside className="season-note">
              <div className="note-icon"><Icon name="ball" size={22} /></div>
              <span className="eyebrow">Built for the boundary</span>
              <h2>Keep the game moving.</h2>
              <p>Share a live score, follow the bracket, and keep every team on the same page.</p>
              <div className="note-rule" />
              <span className="note-caption">DESIGNED FOR THE WHOLE GROUND</span>
            </aside>
          </section>

          <section className="tournament-section" id="tournaments">
            <div className="section-heading">
              <div><span className="eyebrow">The season board</span><h2>Your tournaments <span>{tournaments.length}</span></h2></div>
              <button className="text-action" type="button" onClick={() => dialogRef.current?.showModal()}>Create tournament <Icon name="arrow" size={16} /></button>
            </div>
            {loadingTournaments ? <p className="demo-disclaimer">Loading your tournaments...</p> : visibleTournaments.length === 0 ? <p className="demo-disclaimer">No tournaments yet. Create one to start your season.</p> : <div className="tournament-list">
              {visibleTournaments.map((tournament, index) => (
                <article className="tournament-row" key={`${tournament.name}-${index}`}>
                  <div className={`tournament-glyph glyph-${index % 3}`}><Icon name={index % 3 === 1 ? 'score' : 'cup'} size={19} /></div>
                  <div className="tournament-name"><strong>{tournament.name}</strong><span>{tournament.format} <i /> {tournament.teams ? `${tournament.teams} teams` : 'No teams yet'}</span></div>
                  <div className="tournament-detail"><small>{tournament.startDate || 'SEASON'}</small><span>{tournament.venue || (index === 0 ? 'Summer' : index === 1 ? 'Weekend' : 'Spring')}</span></div>
                  <div className="tournament-status"><StatusPill status={tournament.status} /><small>{tournament.note}</small></div>
                  <button className="row-open" type="button" aria-label={`Manage teams for ${tournament.name}`} onClick={() => openTeams(tournament)}><Icon name="arrow" size={17} /></button>
                </article>
              ))}
            </div>}
            {!organizerUid && <p className="demo-disclaimer"><Icon name="check" size={14} /> Sample details are for layout preview only. New tournaments stay in memory until you refresh.</p>}
          </section>

          <section className="next-steps" id="next-steps">
            <div><span className="eyebrow">Next at the crease</span><h2>Ready when your season is.</h2></div>
            <p>Firebase sign-in, saved tournaments, team registration, and real scoring are queued up next.</p>
            <button className="button button-outline" type="button" onClick={() => dialogRef.current?.showModal()}>Start with a tournament <Icon name="arrow" size={16} /></button>
          </section>

          <footer className="page-footer"><span>BOUNDARY · CRICKET TOURNAMENTS</span><span>V1 PREVIEW · NO SIGN-IN OR CLOUD SYNC</span></footer>
        </div>
      </main>
      <TournamentDialog dialogRef={dialogRef} onCreate={addTournament} canSave={Boolean(organizerUid)} />
      <TeamDialog dialogRef={teamDialogRef} tournament={selectedTournament} canManage={Boolean(organizerUid && selectedTournament?.id)} onTeamAdded={updateTeamCount} onRegistrationChanged={updateRegistrationState} onSelectFixture={(fixture, tournament) => {
        const tournamentId = tournament.id
        const matchKey = tournamentId ? `${tournamentId}_${fixture.id}` : null
        setLoadedMatchKey(null)
        setScoreSaveStatus(tournamentId && organizerUid ? 'Loading saved score...' : '')
        currentPreviewScoreRef.current = { key: matchKey, deliveries: JSON.stringify([]) }
        setPreviewMatch({ tournamentId, tournamentName: tournament.name, oversLimit: tournament.overs, ballsPerOver: tournament.ballsPerOver, fixture })
        setPreviewDeliveries([])
      }} />
    </div>
  )
}

export default App
