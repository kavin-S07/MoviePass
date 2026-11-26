import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchShows } from '../services/shows'

export default function ShowsPage({ onNavigate }) {
  const { token } = useAuth()

  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [theatreFilter, setTheatreFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShows(token)
      .then((data) => { if (!cancelled) setShows(Array.isArray(data) ? data : []) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load shows') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const theatres = useMemo(() => {
    const map = new Map()
    shows.forEach((s) => {
      const id = s.theatre_id ?? s.theatre_name
      if (id == null) return
      if (!map.has(String(id))) map.set(String(id), { id: String(id), name: s.theatre_name || `Theatre #${s.theatre_id}` })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [shows])

  const filteredShows = useMemo(() => {
    if (theatreFilter === 'all') return shows
    return shows.filter((s) => String(s.theatre_id ?? s.theatre_name) === theatreFilter)
  }, [shows, theatreFilter])

  if (loading) return <div className="dash-loading">Loading shows...</div>

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Shows</h1>
          <p>Schedule movies on your theatre screens. Click a show to view seat bookings and revenue.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('add-show')}>
          + Schedule Show
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label>
            <span>Filter by Theatre</span>
            <select value={theatreFilter} onChange={(e) => setTheatreFilter(e.target.value)}>
              <option value="all">All Theatres</option>
              {theatres.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filteredShows.length === 0 ? (
        <div className="panel empty-state">
          <p>{shows.length === 0 ? 'No shows scheduled yet.' : 'No shows found for the selected theatre.'}</p>
          {shows.length === 0 && (
            <button className="btn-primary" onClick={() => onNavigate('add-show')}>
              Schedule your first show
            </button>
          )}
        </div>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2>Scheduled Shows ({filteredShows.length})</h2>
          </div>
          <ul className="recent-list">
            {filteredShows.map((show) => (
              <li key={show.show_id} className="recent-item" style={{ alignItems: 'center' }}>
                <div className="recent-info">
                  <strong>{show.movie_name}</strong>
                  <span className="muted">{show.theatre_name} • {show.screen_name}</span>
                  <span className="muted">{show.show_date} • {show.start_time} - {show.end_time}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${show.status === 'Scheduled' ? 'badge-blue' : show.status === 'Completed' ? 'badge-green' : 'badge-gray'}`}>
                    {show.status}
                  </span>
                  <button type="button" className="btn-small" onClick={() => onNavigate('show-details', show.show_id)}>
                    View Details
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
