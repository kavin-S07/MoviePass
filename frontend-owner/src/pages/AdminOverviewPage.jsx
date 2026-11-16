import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAdminOverview } from '../services/admin'

function formatDateTime(date, time) {
  if (!date) return '-'
  return `${date}${time ? ` ${String(time).slice(0, 5)}` : ''}`
}

export default function AdminOverviewPage({ onNavigate }) {
  const { token, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminOverview(token)
      setData(res)
    } catch (err) {
      setError(err.message || 'Could not load admin overview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  if (loading) return <div className="dash-loading">Loading admin overview...</div>
  if (error) {
    return (
      <div className="dash-error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={load}>Retry</button>
      </div>
    )
  }

  const s = data.summary || {}
  const cards = [
    { label: 'Total Users', value: s.total_users ?? 0, tone: 'tone-blue' },
    { label: 'Pending Owner Approvals', value: s.pending_owner_approvals ?? 0, tone: 'tone-amber' },
    { label: 'Theatres', value: s.total_theatres ?? 0, tone: 'tone-red' },
    { label: 'Screens', value: s.total_screens ?? 0, tone: 'tone-violet' },
    { label: 'Movies', value: s.total_movies ?? 0, tone: 'tone-green' },
    { label: 'Shows', value: s.total_shows ?? 0, tone: 'tone-blue' },
    { label: 'Upcoming Shows', value: s.upcoming_shows ?? 0, tone: 'tone-green' },
  ]

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Admin Overview</h1>
          <p>Platform-wide metrics and activity snapshot{user?.name ? ` for ${user.name}` : ''}.</p>
        </div>
        <div className="dash-quick">
          <button className="btn-primary" onClick={() => onNavigate('approvals')}>Review Approvals</button>
          <button className="btn-secondary" onClick={() => onNavigate('users')}>Manage Users</button>
          <button className="btn-secondary" onClick={load}>Refresh</button>
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
            <h2>Pending Theatre Owner Approvals</h2>
            <button className="link-button" onClick={() => onNavigate('approvals')}>View all →</button>
          </div>
          {!data.pending_owners?.length ? (
            <div className="empty-state"><p>No pending approvals.</p></div>
          ) : (
            <ul className="recent-list">
              {data.pending_owners.map((o) => (
                <li key={o.user_id} className="recent-item">
                  <div className="recent-info">
                    <strong>{o.name}</strong>
                    <span className="muted">{o.email}{o.phone_no ? ` • ${o.phone_no}` : ''}</span>
                  </div>
                  <span className="badge badge-blue">{o.approval_status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent Theatres</h2>
            <button className="link-button" onClick={() => onNavigate('theatres')}>View all →</button>
          </div>
          {!data.recent_theatres?.length ? (
            <div className="empty-state"><p>No theatres yet.</p></div>
          ) : (
            <ul className="recent-list">
              {data.recent_theatres.map((t) => (
                <li key={t.theatre_id} className="recent-item">
                  <div className="recent-info">
                    <strong>{t.name}</strong>
                    <span className="muted">{t.city ? `${t.city} • ` : ''}{t.address}</span>
                  </div>
                  <span className={`badge ${t.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head"><h2>Upcoming Shows</h2><button className="link-button" onClick={() => onNavigate('shows')}>View all →</button></div>
          {!data.upcoming_shows?.length ? (
            <div className="empty-state"><p>No upcoming shows scheduled.</p></div>
          ) : (
            <ul className="recent-list">
              {data.upcoming_shows.map((show) => (
                <li key={show.show_id} className="recent-item">
                  <div className="recent-info">
                    <strong>{show.movie_name}</strong>
                    <span className="muted">{show.theatre_name} • {show.screen_name}</span>
                    <span className="muted">{formatDateTime(show.show_date, show.start_time)}</span>
                  </div>
                  <span className={`badge ${show.status === 'Scheduled' ? 'badge-blue' : 'badge-gray'}`}>{show.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Breakdowns</h2></div>
          <div className="details-grid">
            <div>
              <strong>Users by role</strong>
              <ul className="simple-list">
                {(data.role_breakdown || []).map((r) => <li key={r.role}>{r.role}: {r.count}</li>)}
                {!data.role_breakdown?.length && <li className="muted">No data</li>}
              </ul>
            </div>
            <div>
              <strong>Owner approval statuses</strong>
              <ul className="simple-list">
                {(data.owner_approval_breakdown || []).map((r) => <li key={r.status}>{r.status}: {r.count}</li>)}
                {!data.owner_approval_breakdown?.length && <li className="muted">No data</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
