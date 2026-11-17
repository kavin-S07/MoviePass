import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchMovie } from '../services/movies'

export default function MovieDetailsPage({ movieId, onNavigate }) {
  const { token } = useAuth()

  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMovie(movieId, token)
      .then((data) => { if (!cancelled) setMovie(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load movie') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [movieId, token])

  if (loading) return <div className="dash-loading">Loading movie...</div>
  if (error) {
    return (
      <div className="dash-error">
        <p>{error}</p>
        <button className="btn-secondary" onClick={() => onNavigate('movies')}>Back to Movies</button>
      </div>
    )
  }

  const rows = [
    ['Release Date', movie.release_date || '—'],
    ['Duration', movie.duration_minutes ? `${movie.duration_minutes} minutes` : '—'],
    ['Language', movie.language || '—'],
    ['Genre', movie.genre || '—'],
    ['Certification', movie.certification || '—'],
    ['Director', movie.director_name || '—'],
    ['Cast', movie.cast_names || '—'],
  ]

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>{movie.movie_name}</h1>
          <p>Movie details</p>
        </div>
        <div className="dash-quick">
          <button className="btn-secondary" onClick={() => onNavigate('movies')}>Back</button>
          <button className="btn-primary" onClick={() => onNavigate('edit-movie', movie.movie_id)}>Edit Movie</button>
        </div>
      </header>

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head"><h2>Poster &amp; Synopsis</h2></div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {movie.poster_url ? (
              <img
                src={movie.poster_url}
                alt={`${movie.movie_name} poster`}
                style={{ width: '100%', maxWidth: 180, height: 'auto', aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', flex: '0 0 auto' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div style={{ width: '100%', maxWidth: 180, aspectRatio: '2 / 3', borderRadius: 10, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flex: '0 0 auto' }}>
                No Poster
              </div>
            )}
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <p style={{ whiteSpace: 'pre-wrap', marginTop: 0, overflowWrap: 'anywhere' }}>{movie.description || 'No description provided.'}</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Movie Information</h2></div>
          <dl className="details-grid">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
