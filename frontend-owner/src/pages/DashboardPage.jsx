import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchDashboardStats } from '../services/theatres'
import { Icon } from '../components/navIcons'

const KPIS = [
  { key: 'total_theatres', label: 'Theatres', icon: 'theatres', tone: 'red', to: 'theatres' },
  { key: 'total_screens', label: 'Screens', icon: 'screens', tone: 'blue', to: 'screens' },
  { key: 'total_movies', label: 'Movies', icon: 'movies', tone: 'amber', to: 'movies' },
  { key: 'total_shows', label: 'Total shows', icon: 'shows', tone: 'green', to: 'shows' },
  { key: 'upcoming_shows', label: 'Upcoming shows', icon: 'calendar', tone: 'violet', to: 'shows' },
]

function greeting() {

  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function dateChip(value) {

  const d = new Date(`${value}T00:00:00`)

  if (Number.isNaN(d.getTime())) return { month: '', day: value || '—' }

  return {
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    day: d.getDate(),
  }
}

function statusClass(status) {

  if (status === 'ACTIVE') return 'badge-green'
  if (status === 'Scheduled') return 'badge-blue'
  return 'badge-gray'
}

function DashboardSkeleton() {

  return (
    <div className="dx" aria-busy="true" aria-label="Loading dashboard">
      <div className="dx-skel dx-skel-hero" />
      <div className="dx-kpis">
        {KPIS.map((k) => <div key={k.key} className="dx-skel dx-skel-kpi" />)}
      </div>
      <div className="dx-grid">
        <div className="dx-skel dx-skel-panel" />
        <div className="dx-skel dx-skel-panel" />
      </div>
    </div>
  )
}

export default function DashboardPage({ onNavigate }) {

  const { token, user } = useAuth()

  const [stats, setStats] = useState(null)

  const [error, setError] = useState('')

  const [loading, setLoading] = useState(true)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {

    let cancelled = false

    setLoading(true)

    setError('')

    fetchDashboardStats(token)
      .then((data) => {

        if (!cancelled) setStats(data)
      })
      .catch((err) => {

        if (!cancelled) setError(err.message || 'Could not load dashboard')
      })
      .finally(() => {

        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  if (loading) return <DashboardSkeleton />

  if (error || !stats) {

    return (
      <div className="dx">
        <div className="dx-card dx-error" role="alert">
          <h2>Something went wrong</h2>
          <p>{error || 'No data returned.'}</p>
          <button type="button" className="btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const summary = stats.summary || {}
  const recentTheatres = stats.recent_theatres || []
  const upcomingShows = stats.upcoming_shows || []

  const steps = [
    { label: 'Add your first theatre', done: summary.total_theatres > 0, action: () => onNavigate('add-theatre') },
    { label: 'Create a screen & seat layout', done: summary.total_screens > 0, action: () => onNavigate('screens', null, { picker: true }) },
    { label: 'Add a movie to your catalogue', done: summary.total_movies > 0, action: () => onNavigate('add-movie') },
    { label: 'Schedule a show', done: summary.total_shows > 0, action: () => onNavigate('add-show') },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const percent = Math.round((doneCount / steps.length) * 100)
  const nextStep = steps.find((s) => !s.done)

  const firstName = user?.name?.split(' ')[0] || 'Owner'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="dx">
      <section className="dx-hero">
        <div className="dx-hero-text">
          <span className="dx-eyebrow">{today}</span>
          <h1>{greeting()}, {firstName}</h1>
          <p>Here is a snapshot of your cinema business.</p>
        </div>
        <div className="dx-hero-actions">
          <button type="button" className="btn-primary dx-btn" onClick={() => onNavigate('add-theatre')}>
            <Icon name="plus" size={16} /> Theatre
          </button>
          <button type="button" className="btn-secondary dx-btn" onClick={() => onNavigate('screens', null, { picker: true })}>
            <Icon name="plus" size={16} /> Screen
          </button>
          <button type="button" className="btn-secondary dx-btn" onClick={() => onNavigate('add-movie')}>
            <Icon name="plus" size={16} /> Movie
          </button>
          <button type="button" className="btn-secondary dx-btn" onClick={() => onNavigate('add-show')}>
            <Icon name="plus" size={16} /> Show
          </button>
        </div>
      </section>

      <section className="dx-kpis" aria-label="Key numbers">
        {KPIS.map((kpi) => (
          <button
            type="button"
            key={kpi.key}
            className={`dx-kpi dx-tone-${kpi.tone}`}
            onClick={() => onNavigate(kpi.to)}
          >
            <span className="dx-kpi-icon"><Icon name={kpi.icon} size={20} /></span>
            <span className="dx-kpi-value">{summary[kpi.key] ?? 0}</span>
            <span className="dx-kpi-label">{kpi.label}</span>
            <Icon name="arrow" size={16} className="dx-kpi-arrow" />
          </button>
        ))}
      </section>

      <div className="dx-grid">
        <section className="dx-card">
          <div className="dx-card-head">
            <h2>Upcoming shows</h2>
            <button type="button" className="dx-link" onClick={() => onNavigate('shows')}>
              View all <Icon name="arrow" size={14} />
            </button>
          </div>

          {upcomingShows.length === 0 ? (
            <div className="dx-empty">
              <span className="dx-empty-icon"><Icon name="calendar" size={24} /></span>
              <p>No upcoming shows scheduled yet.</p>
              <button type="button" className="btn-secondary" onClick={() => onNavigate('add-show')}>
                Schedule your first show
              </button>
            </div>
          ) : (
            <ul className="dx-list">
              {upcomingShows.map((show) => {

                const chip = dateChip(show.show_date)

                return (
                  <li key={show.show_id} className="dx-row">
                    <span className="dx-date">
                      <small>{chip.month}</small>
                      <strong>{chip.day}</strong>
                    </span>
                    <div className="dx-row-main">
                      <strong>{show.movie_name}</strong>
                      <span>{show.theatre_name} · {show.screen_name}</span>
                      <span className="dx-time">{show.start_time}</span>
                    </div>
                    <span className={`badge ${statusClass(show.status)}`}>{show.status}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="dx-side">
          <section className="dx-card">
            <div className="dx-card-head">
              <h2>Setup progress</h2>
              <span className="dx-pill">{doneCount}/{steps.length}</span>
            </div>

            <div
              className="dx-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Setup progress"
            >
              <span style={{ width: `${percent}%` }} />
            </div>

            <ul className="dx-steps">
              {steps.map((step) => (
                <li key={step.label} className={step.done ? 'is-done' : ''}>
                  <span className="dx-step-dot" aria-hidden="true">
                    {step.done && <Icon name="check" size={12} />}
                  </span>
                  <span className="dx-step-label">{step.label}</span>
                  <span className="dx-sr">{step.done ? ' (completed)' : ''}</span>
                </li>
              ))}
            </ul>

            {nextStep ? (
              <button type="button" className="btn-primary dx-next" onClick={nextStep.action}>
                {nextStep.label} <Icon name="arrow" size={16} />
              </button>
            ) : (
              <p className="dx-done-note">Everything is set up. Your cinema is ready for bookings.</p>
            )}
          </section>

          <section className="dx-card">
            <div className="dx-card-head">
              <h2>Recent theatres</h2>
              <button type="button" className="dx-link" onClick={() => onNavigate('theatres')}>
                View all <Icon name="arrow" size={14} />
              </button>
            </div>

            {recentTheatres.length === 0 ? (
              <div className="dx-empty">
                <span className="dx-empty-icon"><Icon name="theatres" size={24} /></span>
                <p>No theatres yet.</p>
                <button type="button" className="btn-primary" onClick={() => onNavigate('add-theatre')}>
                  Add your first theatre
                </button>
              </div>
            ) : (
              <ul className="dx-list">
                {recentTheatres.map((theatre) => (
                  <li key={theatre.theatre_id}>
                    <button
                      type="button"
                      className="dx-row dx-row-btn"
                      onClick={() => onNavigate('details', theatre.theatre_id)}
                    >
                      <span className="dx-thumb"><Icon name="theatres" size={18} /></span>
                      <div className="dx-row-main">
                        <strong>{theatre.name}</strong>
                        <span>{theatre.city ? `${theatre.city} · ` : ''}{theatre.address}</span>
                      </div>
                      <span className={`badge ${statusClass(theatre.status)}`}>{theatre.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
