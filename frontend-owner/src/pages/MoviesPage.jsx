import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { deleteMovie, fetchMovies } from '../services/movies'

export default function MoviesPage({ onNavigate }) {
  const { token } = useAuth()

  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchMovies(token)
      setMovies(data)
    } catch (err) {
      setError(err.message || 'Could not load movies')
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
      await deleteMovie(id, token)
      setMovies((prev) => prev.filter((m) => m.movie_id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(err.message || 'Could not delete movie')
    }
  }

  if (loading) {
    return <div className="dash-loading">Loading movies...</div>
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Movies</h1>
          <p>Manage movies available for your theatre shows.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('add-movie')}>
          + Add Movie
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {movies.length === 0 ? (
        <div className="panel empty-state">
          <p>No movies added yet.</p>
          <button className="btn-primary" onClick={() => onNavigate('add-movie')}>
            + Add your first movie
          </button>
        </div>
      ) : (
        <div className="theatre-grid">
          {movies.map((movie) => (
            <article key={movie.movie_id} className="theatre-card">
              <div className="theatre-card-head">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={`${movie.movie_name} poster`}
                      style={{ width: 64, height: 96, objectFit: 'cover', borderRadius: 8, background: '#f1f5f9' }}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div style={{ width: 64, height: 96, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#64748b' }}>
                      No Poster
                    </div>
                  )}
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{movie.movie_name}</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {[movie.genre, movie.language, movie.certification].filter(Boolean).join(' • ') || 'No genre/language details'}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="theatre-meta">
                <div>
                  <dt>Duration</dt>
                  <dd>{movie.duration_minutes ? `${movie.duration_minutes} min` : '—'}</dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>{movie.release_date || '—'}</dd>
                </div>
                <div>
                  <dt>Director</dt>
                  <dd>{movie.director_name || '—'}</dd>
                </div>
              </dl>

              <div className="theatre-actions">
                <button className="btn-small" onClick={() => onNavigate('movie-details', movie.movie_id)}>View</button>
                <button className="btn-small" onClick={() => onNavigate('edit-movie', movie.movie_id)}>Edit</button>
                <button className="btn-small danger" onClick={() => setConfirmId(movie.movie_id)}>Delete</button>
              </div>

              {confirmId === movie.movie_id && (
                <div className="confirm-bar">
                  <span>Delete this movie?</span>
                  <div>
                    <button className="btn-small" onClick={() => setConfirmId(null)}>Cancel</button>
                    <button className="btn-small danger" onClick={() => handleDelete(movie.movie_id)}>Delete</button>
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
