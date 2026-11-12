import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchTheatre, deleteTheatre } from '../services/theatres'

export default function TheatreDetailsPage({ theatreId, onNavigate }) {

  const { token } = useAuth()

  const [theatre, setTheatre] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {

    let cancelled = false

    fetchTheatre(theatreId, token)
      .then((data) => {

        if (!cancelled) setTheatre(data)
      })
      .catch((err) => {

        if (!cancelled) setError(err.message || 'Could not load theatre')
      })
      .finally(() => {

        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [theatreId, token])

  if (loading) {

    return <div className="dash-loading">Loading theatre...</div>
  }

  if (error) {

    return (
      <div className="dash-error">
        <p>{error}</p>
        <button className="btn-secondary" onClick={() => onNavigate('theatres')}>
          Back to Theatres
        </button>
      </div>
    )
  }

  const rows = [
    ['Address', theatre.address],
    ['City', theatre.city || '—'],
    ['State', theatre.state || '—'],
    ['Pincode', theatre.pincode || '—'],
    ['Contact', theatre.contact_number || '—'],
    ['Latitude', theatre.latitude ?? '—'],
    ['Longitude', theatre.longitude ?? '—'],
  ]

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>{theatre.name}</h1>
          <p>Theatre details and screens</p>
        </div>

        <div className="dash-quick">
          <button className="btn-secondary" onClick={() => onNavigate('edit-theatre', theatre.theatre_id)}>
            Edit Theatre
          </button>
          <button className="btn-primary" onClick={() => onNavigate('add-screen', theatre.theatre_id)}>
            + Add Screen
          </button>
        </div>
      </header>

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Theatre Information</h2>
            <span className={`badge ${theatre.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
              {theatre.status}
            </span>
          </div>

          <dl className="details-grid">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Screens ({theatre.screens.length})</h2>
            <button className="btn-small" onClick={() => onNavigate('add-screen', theatre.theatre_id)}>
              + Add Screen
            </button>
          </div>

          {theatre.screens.length === 0 ? (
            <div className="empty-state">
              <p>No screens configured yet.</p>
            </div>
          ) : (
            <ul className="recent-list">
              {theatre.screens.map((screen) => (
                <li key={screen.screen_id} className="recent-item">
                  <div className="recent-info">
                    <strong>{screen.screen_name}</strong>
                    <span className="muted">
                      {screen.no_of_rows} rows × {screen.no_of_columns} columns • {screen.seat_count} seats
                    </span>
                  </div>
                  <span className={`badge ${screen.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                    {screen.status}
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
