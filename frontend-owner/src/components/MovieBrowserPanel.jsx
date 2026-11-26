import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { toList } from '../services/api'
import { fetchAvailableMovies } from '../services/movies'

const PAGE_SIZE = 12

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

// Lists every movie in the global catalogue that is NOT yet mapped to the
// owner's theatre (the server applies that rule), with name search. Picking a
// movie hands it back to the Add Movie form via onSelect.
export default function MovieBrowserPanel({ selectedId = null, onSelect, onClose }) {
  const { token } = useAuth()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAvailableMovies(token, { search: debouncedQuery })
      .then((data) => {
        if (cancelled) return
        setMovies(toList(data))
        setVisible(PAGE_SIZE)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load movies')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token, debouncedQuery, reloadKey])

  const shown = movies.slice(0, visible)
  const searching = debouncedQuery.trim() !== ''

  return (
    <section className="panel movie-browser owner-movies-page" aria-label="Choose an existing movie">
      <div className="movie-browser-head">
        <div>
          <h2>Choose an existing movie</h2>
          <p>Movies already in MoviePass that are not in your theatre yet. Select one to fill the form below.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <input
        type="search"
        className="movie-browser-search"
        placeholder="Search movies by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search movies by name"
      />

      <div aria-live="polite">
        {loading && <p className="movie-browser-status">Loading movies...</p>}

        {!loading && error && (
          <div className="movie-browser-status">
            <p className="error">{error}</p>
            <button type="button" className="btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
          </div>
        )}

        {!loading && !error && movies.length === 0 && (
          <p className="movie-browser-status">
            {searching
              ? `No movies match "${debouncedQuery.trim()}".`
              : 'No other movies are available to add. Every movie in MoviePass is already in your theatre.'}
          </p>
        )}

        {!loading && !error && movies.length > 0 && (
          <p className="movie-browser-status">
            {movies.length} {movies.length === 1 ? 'movie' : 'movies'} available
          </p>
        )}
      </div>

      {!error && movies.length > 0 && (
        <>
          <div className="movie-browser-scroll">
            <div className="movie-grid">
              {shown.map((movie) => {
                const isSelected = movie.movie_id === selectedId
                return (
                  <article key={movie.movie_id} className={`movie-card${isSelected ? ' is-selected' : ''}`}>
                    <button
                      className="movie-card-poster-wrap"
                      type="button"
                      onClick={() => onSelect(movie)}
                      aria-label={`Select ${movie.movie_name}`}
                    >
                      {movie.poster_url ? (
                        <img
                          src={movie.poster_url}
                          alt={movie.movie_name}
                          className="movie-card-poster"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.classList?.remove('hidden') }}
                        />
                      ) : (
                        <div className="movie-card-poster placeholder-poster">No Poster</div>
                      )}
                      {movie.poster_url ? <div className="movie-card-poster placeholder-poster hidden" aria-hidden="true">No Poster</div> : null}
                    </button>
                    <div className="movie-card-body">
                      <h3 className="movie-card-title" title={movie.movie_name}>{movie.movie_name}</h3>
                      <p className="movie-card-meta">{movie.genre || 'Genre N/A'} • {movie.language || 'Language N/A'}</p>
                      <p className="movie-card-meta">{formatDuration(movie.duration_minutes)} • {movie.certification || 'NR'}</p>
                      <p className="movie-card-meta">Release: {movie.release_date || 'TBA'}</p>
                      {movie.director_name && <p className="movie-card-meta">Director: {movie.director_name}</p>}
                      <div className="movie-card-actions">
                        <button
                          type="button"
                          className={isSelected ? 'btn-secondary' : 'btn-primary'}
                          onClick={() => onSelect(movie)}
                          disabled={isSelected}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          {visible < movies.length && (
            <div className="movie-browser-more">
              <button type="button" className="btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more ({movies.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
