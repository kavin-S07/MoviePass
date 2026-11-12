import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchDashboardStats } from '../services/theatres'

export default function DashboardPage({ onNavigate }) {

  const { token, user } = useAuth()

  const [stats, setStats] = useState(null)

  const [error, setError] = useState('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {

    let cancelled = false

    setLoading(true)

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
  }, [token])

  if (loading) {

    return <div className="dash-loading">Loading dashboard...</div>
  }

  if (error) {

    return (
      <div className="dash-error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  const summary = stats.summary

  const cards = [
    { label: 'Total Theatres', value: summary.total_theatres, tone: 'tone-red' },
    { label: 'Total Screens', value: summary.total_screens, tone: 'tone-blue' },
    { label: 'Movies', value: summary.total_movies, tone: 'tone-amber' },
    { label: 'Shows', value: summary.total_shows, tone: 'tone-green' },
    { label: 'Upcoming Shows', value: summary.upcoming_shows, tone: 'tone-violet' },
  ]

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0] || 'Owner'}</h1>
          <p>Here is a snapshot of your cinema business.</p>
        </div>
        <div className="dash-quick">
          <button className="btn-primary" onClick={() => onNavigate('add-theatre')}>
            + Add Theatre
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('movies')}>
            + Add Movie
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('shows')}>
            + Create Show
          </button>
        </div>
      </header>

      <section className="summary-grid">
        {cards.map((card) => (
          <div key={card.label} className={`summary-card ${card.tone}`}>
            <div className="summary-value">{card.value}</div>
            <div className="summary-label">{card.label}</div>
          </div>
        ))}
      </section>

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Recent Theatres</h2>
            <button className="link-button" onClick={() => onNavigate('theatres')}>
              View all Theatres →
            </button>
          </div>

          {stats.recent_theatres.length === 0 ? (
            <div className="empty-state">
              <p>No theatres yet.</p>
              <button className="btn-primary" onClick={() => onNavigate('add-theatre')}>
                + Add your first theatre
              </button>
            </div>
          ) : (
            <ul className="recent-list">
              {stats.recent_theatres.map((theatre) => (
                <li key={theatre.theatre_id} className="recent-item">
                  <div className="recent-info">
                    <strong>{theatre.name}</strong>
                    <span className="muted">
                      {theatre.city ? `${theatre.city} • ` : ''}{theatre.address}
                    </span>
                  </div>
                  <span className={`badge ${theatre.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                    {theatre.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Upcoming Shows</h2>
            <button className="link-button" onClick={() => onNavigate('shows')}>
              View all Shows →
            </button>
          </div>

          {stats.upcoming_shows.length === 0 ? (
            <div className="empty-state">
              <p>No upcoming shows scheduled yet.</p>
              <button className="btn-secondary" onClick={() => onNavigate('shows')}>
                Schedule your first show
              </button>
            </div>
          ) : (
            <ul className="recent-list">
              {stats.upcoming_shows.map((show) => (
                <li key={show.show_id} className="recent-item">
                  <div className="recent-info">
                    <strong>{show.movie_name}</strong>
                    <span className="muted">
                      {show.theatre_name} • {show.screen_name}
                    </span>
                    <span className="muted">
                      {show.show_date} at {show.start_time}
                    </span>
                  </div>
                  <span className={`badge ${show.status === 'Scheduled' ? 'badge-blue' : 'badge-gray'}`}>
                    {show.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
