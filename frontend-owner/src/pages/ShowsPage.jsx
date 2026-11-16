import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchShows } from '../services/shows'

export default function ShowsPage({ onNavigate }) {
  const { token } = useAuth()

  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShows(token)
      .then((data) => { if (!cancelled) setShows(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load shows') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  if (loading) return <div className="dash-loading">Loading shows...</div>

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Shows</h1>
          <p>Schedule movies on your theatre screens.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('add-show')}>
          + Schedule Show
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {shows.length === 0 ? (
        <div className="panel empty-state">
          <p>No shows scheduled yet.</p>
          <button className="btn-primary" onClick={() => onNavigate('add-show')}>
            Schedule your first show
          </button>
        </div>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2>Scheduled Shows ({shows.length})</h2>
          </div>
          <ul className="recent-list">
            {shows.map((show) => (
              <li key={show.show_id} className="recent-item">
                <div className="recent-info">
                  <strong>{show.movie_name}</strong>
                  <span className="muted">{show.theatre_name} • {show.screen_name}</span>
                  <span className="muted">{show.show_date} • {show.start_time} - {show.end_time}</span>
                </div>
                <span className={`badge ${show.status === 'Scheduled' ? 'badge-blue' : show.status === 'Completed' ? 'badge-green' : 'badge-gray'}`}>
                  {show.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
