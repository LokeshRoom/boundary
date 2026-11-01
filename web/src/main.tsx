import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import RegistrationPage from './RegistrationPage.tsx'
import PublicMatchPage from './PublicMatchPage.tsx'

const registrationMatch = window.location.pathname.match(/^\/t\/([^/]+)\/register\/?$/)
const registrationTournamentId = registrationMatch?.[1] ?? null
const publicMatch = window.location.pathname.match(/^\/t\/([^/]+)\/match\/([^/]+)\/?$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {registrationTournamentId ? <RegistrationPage tournamentId={registrationTournamentId} /> : publicMatch ? <PublicMatchPage tournamentId={publicMatch[1]} fixtureId={publicMatch[2]} /> : <App />}
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
