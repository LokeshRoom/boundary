import { useEffect, useState } from 'react'
import { isFirebaseConfigured } from './firebase'
import { getPublicLiveMatchSummary, getPublicTournamentScoreSettings } from './tournaments'
import type { PublicLiveMatchSummary } from './scoring'
import './App.css'
import './PublicMatchPage.css'

function ballLabel(ball: PublicLiveMatchSummary['snapshot']['recentBalls'][number]) {
  if (ball.isWicket) return 'W'
  if (ball.extrasType === 'WIDE') return 'WD'
  if (ball.extrasType === 'NO_BALL') return 'NB'
  if (ball.extrasType === 'BYE') return `${ball.completedRuns + ball.extrasRuns}B`
  if (ball.extrasType === 'LEG_BYE') return `${ball.completedRuns + ball.extrasRuns}LB`
  return String(ball.runsOffBat + (ball.extrasType === 'PENALTY' ? ball.extrasRuns : 0))
}

export default function PublicMatchPage({ tournamentId, fixtureId }: { tournamentId: string; fixtureId: string }) {
  const [match, setMatch] = useState<PublicLiveMatchSummary | null>(null)
  const [tournamentName, setTournamentName] = useState('')
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [error, setError] = useState(isFirebaseConfigured ? '' : 'This live score link is not connected to Firebase yet.')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    if (!isFirebaseConfigured) {
      return () => { active = false }
    }

    void getPublicTournamentScoreSettings(tournamentId).then(async (settings) => {
      if (!settings) throw new Error('Tournament not found.')
      if (active) setTournamentName(settings.name)
      const result = await getPublicLiveMatchSummary(tournamentId, fixtureId, settings.ballsPerOver)
      if (!result) throw new Error('Match score not found yet.')
      if (active) setMatch(result)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load this match score.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fixtureId, refresh, tournamentId])

  return (
    <main className="public-match-shell">
      <header className="registration-brand"><span className="brand-mark"><span /><span /><span /></span><span>boundary<span className="brand-dot">.</span></span></header>
      <section className="public-match-card">
        <div className="public-match-heading"><div><span className="eyebrow">PUBLIC SCOREBOARD</span><h1>{loading && !match ? 'Loading match…' : tournamentName || 'Match score'}</h1><p>{match ? `${match.groupName ? `${match.groupName} · ` : ''}${match.roundName} · Match ${match.matchNumber}` : 'Follow the match score and recent deliveries.'}</p></div><button className="button button-outline" type="button" disabled={loading || !isFirebaseConfigured} onClick={() => { setLoading(true); setError(''); setRefresh((current) => current + 1) }}>{loading ? 'Loading…' : 'Refresh score'}</button></div>
        {error ? <p className="registration-closed" role="status">{error}</p> : match && <>
          <div className="public-scoreline">
            <div><span>{match.teamA.name}</span><strong>Team A</strong></div>
            <p><strong>{match.snapshot.scoreSummary.runs}/{match.snapshot.scoreSummary.wickets}</strong><span>{match.snapshot.scoreSummary.overs} overs · {match.snapshot.scoreSummary.runRate.toFixed(2)} RPO</span></p>
            <div><span>{match.teamB.name}</span><strong>Team B</strong></div>
          </div>
          <section className="public-recent-balls" aria-label="Recent deliveries">
            <h2>Recent balls <span>Innings {match.snapshot.currentInnings}</span></h2>
            {match.snapshot.recentBalls.length ? <ol>{match.snapshot.recentBalls.map((ball, index) => <li key={`${index}-${ball.strikerId}`} className={ball.isWicket ? 'public-ball-wicket' : ball.extrasType ? 'public-ball-extra' : ''}>{ballLabel(ball)}</li>)}</ol> : <p>No deliveries have been recorded.</p>}
          </section>
          <p className="public-match-note">Refresh to check for the latest score. Full batting and bowling cards are not published yet.</p>
        </>}
      </section>
    </main>
  )
}
