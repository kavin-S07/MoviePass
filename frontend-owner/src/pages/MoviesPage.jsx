import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { deleteMovie, fetchMovies } from '../services/movies'

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

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
      setMovies(Array.isArray(data) ? data : (data?.items || []))
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
    <div className="dash movies-page owner-movies-page">
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
                    <button type="button" className="btn-secondary" onClick={() => onNavigate('edit-movie', movie.movie_id)}>Edit</button>
                    <button type="button" className="btn-small danger" onClick={() => setConfirmId(movie.movie_id)}>Delete</button>
                  </div>
                  {confirmId === movie.movie_id && (
                    <div className="confirm-bar owner-movie-confirm">
                      <span>Delete this movie?</span>
                      <div>
                        <button type="button" className="btn-small" onClick={() => setConfirmId(null)}>Cancel</button>
                        <button type="button" className="btn-small danger" onClick={() => handleDelete(movie.movie_id)}>Delete</button>
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
