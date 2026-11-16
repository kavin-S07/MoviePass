import { useEffect, useState } from 'react'

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export default function MovieDetailsPage({ movieId, fetchDetail, onBack, onBook }) {
  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchDetail(movieId)
        if (!cancelled) setMovie(data)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load movie details')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (movieId) load()
    return () => { cancelled = true }
  }, [movieId, fetchDetail])

  if (loading) return <div className="page-state">Loading movie details...</div>
  if (error) return <div className="page-state error-state-box"><p>{error}</p><button className="btn-secondary" onClick={onBack}>Back</button></div>
  if (!movie) return <div className="page-state">Movie not found.</div>

  const canBook = Boolean(movie.booking_available)
  const isComingSoon = movie.release_status === 'coming_soon'

  return (
    <div className="movie-details-page">
      <button className="btn-link back-link" onClick={onBack}>← Back to movies</button>
      <section className="details-hero">
        <div className="details-poster-wrap">
          {movie.poster_url ? <img src={movie.poster_url} alt={movie.movie_name} className="details-poster" /> : <div className="details-poster placeholder-poster">No Poster</div>}
        </div>
        <div className="details-info">
          <div className="details-badges">
            <span className={`status-badge ${isComingSoon ? 'badge-soon' : canBook ? 'badge-book' : 'badge-released'}`}>{isComingSoon ? 'Coming Soon' : canBook ? 'Booking Available' : 'Now Showing'}</span>
            {movie.certification && <span className="meta-pill">{movie.certification}</span>}
          </div>
          <h1>{movie.movie_name}</h1>
          <p className="details-meta">{movie.genre || 'Genre N/A'} • {movie.language || 'Language N/A'} • {formatDuration(movie.duration_minutes)}</p>
          <p className="details-meta">Release Date: {movie.release_date || 'TBA'}</p>
          <div className="details-actions">
            {canBook ? (
              <button className="btn-primary" onClick={() => onBook(movie)}>Book Tickets</button>
            ) : (
              <button className="btn-disabled" disabled>{isComingSoon ? 'Booking opens when shows are available' : 'No shows available currently'}</button>
            )}
          </div>

          <div className="details-grid">
            <div><strong>Director</strong><p>{movie.director_name || 'N/A'}</p></div>
            <div><strong>Cast</strong><p>{movie.cast_names || 'N/A'}</p></div>
            <div><strong>Language</strong><p>{movie.language || 'N/A'}</p></div>
            <div><strong>Genre</strong><p>{movie.genre || 'N/A'}</p></div>
            <div><strong>Duration</strong><p>{formatDuration(movie.duration_minutes)}</p></div>
            <div><strong>Certification</strong><p>{movie.certification || 'N/A'}</p></div>
            <div><strong>Upcoming Shows</strong><p>{movie.upcoming_show_count ?? 0}</p></div>
            <div><strong>Total Shows</strong><p>{movie.total_show_count ?? 0}</p></div>
          </div>
        </div>
      </section>

      <section className="details-description">
        <h2>Description</h2>
        <p>{movie.description || 'No description available.'}</p>
      </section>
    </div>
  )
}
