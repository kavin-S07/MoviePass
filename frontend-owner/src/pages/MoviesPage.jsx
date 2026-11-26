import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { toList } from '../services/api'
import { deleteMovie } from '../services/movies'
import { fetchMyTheatreMovies } from '../services/theatres'

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export default function MoviesPage({ onNavigate, notice = '', onNoticeShown }) {
  const { token } = useAuth()

  // Only movies mapped to the signed-in owner's theatre (resolved server-side).
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noTheatre, setNoTheatre] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [success, setSuccess] = useState(notice)

  // Show the message handed over by the Add/Edit form once, then clear it.
  useEffect(() => {
    if (!notice) return
    setSuccess(notice)
    onNoticeShown?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(''), 6000)
    return () => clearTimeout(t)
  }, [success])

  async function load() {
    setLoading(true)
    setError('')
    setNoTheatre(false)
    try {
      const result = await fetchMyTheatreMovies(token)
      setMovies(toList(result))
    } catch (err) {
      const msg = err?.message || ''
      if (/not associated with a theatre/i.test(msg)) {
        setNoTheatre(true)
        setMovies([])
      } else {
        setError(msg || 'Could not load movies')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleDelete(id) {
    setDeletingId(id)
    setError('')
    try {
      const res = await deleteMovie(id, token)
      setMovies((prev) => prev.filter((m) => m.movie_id !== id))
      setConfirmId(null)
      setSuccess(res?.message || 'Movie removed')
    } catch (err) {
      setError(err.message || 'Could not delete movie')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="dash-loading">Loading movies...</div>
  }

  return (
    <div className="dash movies-page owner-movies-page">
      <header className="dash-header">
        <div>
          <h1>Movies</h1>
          <p>Movies available in your theatre. Add one from the catalogue or create a new one to schedule shows.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('add-movie')}>
          + Add Movie
        </button>
      </header>

      {noTheatre && (
        <div className="panel empty-state" style={{ marginBottom: 16 }}>
          <p>You are not associated with a theatre yet.</p>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Create or link a theatre first, then add movies to it.</p>
          <button className="btn-primary" onClick={() => onNavigate('theatres')} style={{ marginTop: 12 }}>
            Go to Theatres
          </button>
        </div>
      )}

      {!noTheatre && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          {movies.length} {movies.length === 1 ? 'movie' : 'movies'} in your theatre
        </p>
      )}

      {success && <p className="success" role="status" style={{ marginBottom: 12 }}>{success}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {noTheatre ? null : movies.length === 0 ? (
        <div className="panel empty-state">
          <p>No movies in your theatre yet.</p>
          <button className="btn-primary" onClick={() => onNavigate('add-movie')}>
            + Add your first movie
          </button>
        </div>
      ) : (
        <div className="movie-grid">
          {movies.map((movie) => {
            const isComingSoon = movie.release_status === 'coming_soon'
            const canBook = Boolean(movie.booking_available)
            const statusLabel = isComingSoon ? 'Coming Soon' : canBook ? 'Book Now' : 'Now Showing'
            const statusClass = isComingSoon ? 'badge-soon' : canBook ? 'badge-book' : 'badge-released'
            return (
              <article key={movie.movie_id} className="movie-card">
                <button
                  className="movie-card-poster-wrap"
                  onClick={() => onNavigate('movie-details', movie.movie_id)}
                  type="button"
                  aria-label={`View details for ${movie.movie_name}`}
                >
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.movie_name}
                      className="movie-card-poster"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.classList?.remove('hidden'); }}
                    />
                  ) : (
                    <div className="movie-card-poster placeholder-poster">No Poster</div>
                  )}
                  {movie.poster_url ? <div className="movie-card-poster placeholder-poster hidden" aria-hidden="true">No Poster</div> : null}
                  <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                </button>
                <div className="movie-card-body">
                  <h3 className="movie-card-title" title={movie.movie_name}>{movie.movie_name}</h3>
                  <p className="movie-card-meta">{movie.genre || 'Genre N/A'} • {movie.language || 'Language N/A'}</p>
                  <p className="movie-card-meta">{formatDuration(movie.duration_minutes)} • {movie.certification || 'NR'}</p>
                  <p className="movie-card-meta">Release: {movie.release_date || 'TBA'}</p>
                  <div className="movie-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => onNavigate('movie-details', movie.movie_id)}>View</button>
                    <button type="button" className="btn-small danger" onClick={() => setConfirmId(movie.movie_id)}>Delete</button>
                  </div>
                  {confirmId === movie.movie_id && (
                    <div className="confirm-bar owner-movie-confirm">
                      <span>Remove this movie from your theatre?</span>
                      <div>
                        <button type="button" className="btn-small" onClick={() => setConfirmId(null)} disabled={deletingId === movie.movie_id}>Cancel</button>
                        <button type="button" className="btn-small danger" onClick={() => handleDelete(movie.movie_id)} disabled={deletingId === movie.movie_id}>
                          {deletingId === movie.movie_id ? 'Removing...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
