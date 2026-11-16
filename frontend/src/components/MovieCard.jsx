function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export default function MovieCard({ movie, onViewDetails, onBook }) {
  const canBook = Boolean(movie.booking_available)
  const isComingSoon = movie.release_status === 'coming_soon'

  return (
    <article className="movie-card">
      <button className="movie-card-poster-wrap" onClick={() => onViewDetails(movie)} type="button">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.movie_name} className="movie-card-poster" loading="lazy" />
        ) : (
          <div className="movie-card-poster placeholder-poster">No Poster</div>
        )}
        <span className={`status-badge ${isComingSoon ? 'badge-soon' : canBook ? 'badge-book' : 'badge-released'}`}>
          {isComingSoon ? 'Coming Soon' : canBook ? 'Book Now' : 'Now Showing'}
        </span>
      </button>
      <div className="movie-card-body">
        <h3 className="movie-card-title" title={movie.movie_name}>{movie.movie_name}</h3>
        <p className="movie-card-meta">{movie.genre || 'Genre N/A'} • {movie.language || 'Language N/A'}</p>
        <p className="movie-card-meta">{formatDuration(movie.duration_minutes)} • {movie.certification || 'NR'}</p>
        <p className="movie-card-meta">Release: {movie.release_date || 'TBA'}</p>
        <div className="movie-card-actions">
          <button type="button" className="btn-secondary" onClick={() => onViewDetails(movie)}>View Details</button>
          {canBook ? (
            <button type="button" className="btn-primary" onClick={() => onBook(movie)}>Book Tickets</button>
          ) : (
            <button type="button" className="btn-disabled" disabled>{isComingSoon ? 'Coming Soon' : 'Not Available'}</button>
          )}
        </div>
      </div>
    </article>
  )
}
