import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { getFirebaseAuth, isFirebaseConfigured } from './firebase'
import './App.css'

type Format = 'Knockout' | 'League' | 'Groups + playoffs'
type Status = 'Registration open' | 'Upcoming' | 'Live' | 'Completed'

type Tournament = {
  name: string
  format: Format
  teams: number
  status: Status
  note: string
}

const initialTournaments: Tournament[] = [
  { name: 'Riverside Summer Cup', format: 'Knockout', teams: 12, status: 'Registration open', note: '4 spots left' },
  { name: 'Sunday Turf League', format: 'League', teams: 8, status: 'Live', note: '2nd innings' },
  { name: 'Northside Club Series', format: 'Groups + playoffs', teams: 16, status: 'Completed', note: 'Winner: Cedar CC' },
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

function TournamentDialog({
  dialogRef,
  onCreate,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  onCreate: (tournament: Tournament) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name) return
    onCreate({
      name,
      format: form.get('format') as Format,
      teams: 0,
      status: 'Registration open',
      note: 'Preview only',
    })
    event.currentTarget.reset()
    dialogRef.current?.close()
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
        <p className="form-note">This preview adds a session-only sample. Sign-in and Firebase saving are the next build step.</p>
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button className="button button-primary" type="submit">Add to preview <Icon name="arrow" size={16} /></button>
        </div>
      </form>
    </dialog>
  )
}

function App() {
  const [tournaments, setTournaments] = useState(initialTournaments)
  const [organizer, setOrganizer] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return

    let active = true
    let unsubscribe: (() => void) | undefined
    void getFirebaseAuth().then(({ auth, onAuthStateChanged }) => {
      if (!active) return
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setOrganizer(user?.displayName || user?.email || null)
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

  function addTournament(tournament: Tournament) {
    setTournaments((current) => [tournament, ...current])
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
          <div><strong>{isFirebaseConfigured ? 'Firebase configured' : 'Preview workspace'}</strong><small>{isFirebaseConfigured ? 'Authentication setup is next' : 'Add Firebase settings to connect'}</small></div>
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
                <span className="live-label"><span className="pulse-dot" /> SAMPLE LIVE SCORE</span>
                <span className="match-series">Sunday Turf League · Match 08</span>
              </div>
              <div className="live-scoreline">
                <div className="team-block">
                  <span className="team-crest crest-cedar">CC</span>
                  <div><strong>Cedar CC</strong><small>Batting</small></div>
                </div>
                <div className="score-block"><strong>126<span>/4</span></strong><small>16.2 overs</small></div>
                <span className="versus">V</span>
                <div className="team-block team-away">
                  <span className="team-crest crest-ridge">RC</span>
                  <div><strong>Ridge Club</strong><small>Target 171</small></div>
                </div>
              </div>
              <div className="live-card-bottom">
                <div className="current-batters"><span>ON STRIKE</span><strong>M. Patel <b>48</b> <small>(31)</small></strong><strong>J. Cole <b>22</b> <small>(18)</small></strong></div>
                <div className="run-rate"><span>REQUIRED</span><strong>12.27 <small>RPO</small></strong></div>
              </div>
              <div className="ball-strip" aria-label="Recent deliveries: one, dot, four, wicket, two, wide">
                <span>RECENT BALLS</span><b>1</b><b className="ball-dot">·</b><b className="ball-boundary">4</b><b className="ball-wicket">W</b><b>2</b><b className="ball-extra">WD</b>
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
            <div className="tournament-list">
              {tournaments.map((tournament, index) => (
                <article className="tournament-row" key={`${tournament.name}-${index}`}>
                  <div className={`tournament-glyph glyph-${index % 3}`}><Icon name={index % 3 === 1 ? 'score' : 'cup'} size={19} /></div>
                  <div className="tournament-name"><strong>{tournament.name}</strong><span>{tournament.format} <i /> {tournament.teams ? `${tournament.teams} teams` : 'No teams yet'}</span></div>
                  <div className="tournament-detail"><small>SEASON</small><span>{tournament.note === 'Preview only' ? 'Session' : index === 0 ? 'Summer' : index === 1 ? 'Weekend' : 'Spring'}</span></div>
                  <div className="tournament-status"><StatusPill status={tournament.status} /><small>{tournament.note}</small></div>
                  <button className="row-open" type="button" aria-label={`Open ${tournament.name}`} onClick={() => dialogRef.current?.showModal()}><Icon name="arrow" size={17} /></button>
                </article>
              ))}
            </div>
            <p className="demo-disclaimer"><Icon name="check" size={14} /> Sample details are for layout preview only. New tournaments stay in memory until you refresh.</p>
          </section>

          <section className="next-steps" id="next-steps">
            <div><span className="eyebrow">Next at the crease</span><h2>Ready when your season is.</h2></div>
            <p>Firebase sign-in, saved tournaments, team registration, and real scoring are queued up next.</p>
            <button className="button button-outline" type="button" onClick={() => dialogRef.current?.showModal()}>Start with a tournament <Icon name="arrow" size={16} /></button>
          </section>

          <footer className="page-footer"><span>BOUNDARY · CRICKET TOURNAMENTS</span><span>V1 PREVIEW · NO SIGN-IN OR CLOUD SYNC</span></footer>
        </div>
      </main>
      <TournamentDialog dialogRef={dialogRef} onCreate={addTournament} />
    </div>
  )
}

export default App
