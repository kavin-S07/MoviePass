export default function MovieCard({ movie, onViewDetails }) {
  // Distracting info is intentionally removed: only poster, name and a
  // smaller secondary line with certification + language remain.
  const cert = movie.certification || 'NR'
  const language = movie.language || 'N/A'

  return (
    <button type="button" className="movie-card" onClick={() => onViewDetails?.(movie)}>
      {movie.poster_url ? (
        <img src={movie.poster_url} alt={movie.movie_name} className="movie-card-poster" loading="lazy" />
      ) : (
        <div className="movie-card-poster placeholder-poster" aria-label="Poster unavailable">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 6v4M11 6v4M15 6v4M7 14v4M11 14v4M15 14v4" />
          </svg>
          <span className="poster-unavailable-label">Poster unavailable</span>
        </div>
      )}
      <span className="movie-card-title" title={movie.movie_name}>{movie.movie_name}</span>
      <span className="movie-card-meta">{cert} | {language}</span>
    </button>
  )
}
