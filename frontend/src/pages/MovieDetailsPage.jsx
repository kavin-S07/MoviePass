import { useEffect, useState } from 'react'

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function fmtShortDate(d) {
  if (!d) return 'TBA'
  try {
    const dt = new Date(`${d}T00:00:00`)
    if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
  } catch { /* ignore */ }
  return String(d)
}

function fmtTime(t) {
  if (!t) return ''
  // backend returns HH:MM:SS or HH:MM; show HH:MM
  return String(t).slice(0, 5)
}

function shortSynopsis(description, max = 200) {
  if (!description) return ''
  return description.length > max ? `${description.slice(0, max).trimEnd()}…` : description
}

export default function MovieDetailsPage({ movieId, fetchDetail, fetchDiscovery, onBack, onBook, onSelectShow }) {
  const [movie, setMovie] = useState(null)
  const [discovery, setDiscovery] = useState(null)
  const [showsLoading, setShowsLoading] = useState(false)
  const [showsError, setShowsError] = useState('')
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

  useEffect(() => {
    let cancelled = false
    async function loadShows() {
      if (!movieId) return
      setShowsLoading(true)
      setShowsError('')
      try {
        const data = await fetchDiscovery(movieId)
        if (!cancelled) setDiscovery(data)
      } catch (err) {
        // Showtimes section is optional; keep the rest of the details page usable.
        if (!cancelled) setShowsError(err.message || 'Failed to load showtimes')
      } finally {
        if (!cancelled) setShowsLoading(false)
      }
    }
    loadShows()
    return () => { cancelled = true }
  }, [movieId, fetchDiscovery])

  if (loading) return <div className="page-state">Loading movie details...</div>
  if (error) return <div className="page-state error-state-box"><p>{error}</p><button className="btn-secondary" onClick={onBack}>Back</button></div>
  if (!movie) return <div className="page-state">Movie not found.</div>

  const canBook = Boolean(movie.booking_available)
  const isComingSoon = movie.release_status === 'coming_soon'
  const synopsis = movie.description || ''
  const theatreRows = discovery?.theatres || []

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
          <p className="details-meta">{movie.language || 'Language N/A'} • {movie.genre || 'Genre N/A'} • {formatDuration(movie.duration_minutes)}</p>
          <p className="details-meta">Release Date: {movie.release_date || 'TBA'}</p>
          {synopsis && <p className="details-synopsis-intro">{shortSynopsis(synopsis)}</p>}
          <div className="details-actions">
            {canBook ? (
              <button className="btn-primary" onClick={() => onBook(movie)}>Book Tickets / View Showtimes</button>
            ) : (
              <button className="btn-disabled" disabled>{isComingSoon ? 'Booking opens when shows are available' : 'No shows available currently'}</button>
            )}
          </div>
        </div>
      </section>

      <section className="details-synopsis">
        <h2>Synopsis</h2>
        <p>{synopsis || 'No description available for this movie.'}</p>
      </section>

      <section className="details-cast">
        <h2>Cast and Crew</h2>
        {movie.cast_names ? (
          <p className="cast-names">{movie.cast_names}</p>
        ) : (
          <p className="muted-note">Cast and crew information is not available for this movie.</p>
        )}
      </section>

      <section className="details-grid">
        <div><strong>Language</strong><p>{movie.language || 'N/A'}</p></div>
        <div><strong>Genre</strong><p>{movie.genre || 'N/A'}</p></div>
        <div><strong>Duration</strong><p>{formatDuration(movie.duration_minutes)}</p></div>
        <div><strong>Certification</strong><p>{movie.certification || 'N/A'}</p></div>
        <div><strong>Release Date</strong><p>{movie.release_date || 'TBA'}</p></div>
        <div><strong>Director</strong><p>{movie.director_name || 'N/A'}</p></div>
      </section>

      <section className="details-shows">
        <h2>Showtimes</h2>
        {discovery === null && showsLoading ? (
          <p className="muted-note">Loading showtimes...</p>
        ) : showsError ? (
          <p className="muted-note">{showsError}</p>
        ) : theatreRows.length === 0 ? (
          <div className="empty-state inline-empty">No showtimes are available for this movie right now.</div>
        ) : (
          theatreRows.map((theatre) => (
            <div key={theatre.theatre_id} className="shows-theatre">
              <div className="shows-theatre-header">
                <h3>{theatre.theatre_name}</h3>
                <p className="shows-address">
                  {[theatre.address, [theatre.city, theatre.state].filter(Boolean).join(', '), theatre.pincode].filter(Boolean).join(' • ')}
                </p>
              </div>
              <div className="shows-list">
                {(theatre.shows || []).map((show) => (
                  <button
                    key={show.show_id}
                    type="button"
                    className={`shows-showtime ${show.is_bookable ? 'available' : 'unavailable'}`}
                    onClick={() => onSelectShow?.(show, theatre)}
                    disabled={!show.is_bookable}
                    title={show.is_bookable ? `Select show on ${fmtShortDate(show.show_date)} at ${fmtTime(show.start_time)}` : `Show on ${fmtShortDate(show.show_date)} is ${show.availability_label || 'not available'}`}
                  >
                    <span className="shows-date">{fmtShortDate(show.show_date)}</span>
                    <span className="shows-time">{fmtTime(show.start_time)} – {fmtTime(show.end_time)}</span>
                    {show.screen_name && <span className="shows-sub">{show.screen_name}</span>}
                    {show.price != null && <span className="shows-price">₹{Number(show.price).toFixed(2)}</span>}
                    <span className="shows-status">{show.status}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
