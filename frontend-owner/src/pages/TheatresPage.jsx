import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchTheatres, deleteTheatre } from '../services/theatres'

export default function TheatresPage({ onNavigate }) {

  const { token } = useAuth()

  const [theatres, setTheatres] = useState([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [confirmId, setConfirmId] = useState(null)

  async function load() {

    setLoading(true)

    setError('')

    try {

      const data = await fetchTheatres(token)

      setTheatres(data)

    } catch (err) {

      setError(err.message || 'Could not load theatres')

    } finally {

      setLoading(false)
    }
  }

  useEffect(() => {

    load()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleDelete(id) {

    try {

      await deleteTheatre(id, token)

      setTheatres((prev) => prev.filter((t) => t.theatre_id !== id))

      setConfirmId(null)

    } catch (err) {

      setError(err.message || 'Could not delete theatre')
    }
  }

  if (loading) {

    return <div className="dash-loading">Loading theatres...</div>
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>My Theatres</h1>
          <p>Manage the theatres you own.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('add-theatre')}>
          + Add New Theatre
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {theatres.length === 0 ? (
        <div className="panel empty-state">
          <p>You don't own any theatres yet.</p>
          <button className="btn-primary" onClick={() => onNavigate('add-theatre')}>
            + Add your first theatre
          </button>
        </div>
      ) : (
        <div className="theatre-grid">
          {theatres.map((theatre) => (
            <article key={theatre.theatre_id} className="theatre-card">
              <div className="theatre-card-head">
                <div>
                  <h3>{theatre.name}</h3>
                  <p className="muted">{theatre.address}</p>
                </div>
                <span className={`badge ${theatre.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                  {theatre.status}
                </span>
              </div>

              <dl className="theatre-meta">
                <div>
                  <dt>City</dt>
                  <dd>{theatre.city || '—'}</dd>
                </div>
                <div>
                  <dt>Screens</dt>
                  <dd>{theatre.screen_count ?? 0}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{theatre.contact_number || '—'}</dd>
                </div>
              </dl>

              <div className="theatre-actions">
                <button className="btn-small" onClick={() => onNavigate('details', theatre.theatre_id)}>
                  View Details
                </button>
                <button className="btn-small" onClick={() => onNavigate('edit-theatre', theatre.theatre_id)}>
                  Edit
                </button>
                <button
                  className="btn-small danger"
                  onClick={() => setConfirmId(theatre.theatre_id)}
                >
                  Delete
                </button>
              </div>

              {confirmId === theatre.theatre_id && (
                <div className="confirm-bar">
                  <span>Delete this theatre?</span>
                  <div>
                    <button className="btn-small" onClick={() => setConfirmId(null)}>Cancel</button>
                    <button
                      className="btn-small danger"
                      onClick={() => handleDelete(theatre.theatre_id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
