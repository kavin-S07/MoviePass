import { useEffect, useMemo, useState } from 'react'
import MovieCard from '../components/MovieCard'

const SORT_OPTIONS = [
  { value: 'release_date_desc', label: 'Release Date (Newest)' },
  { value: 'release_date_asc', label: 'Release Date (Oldest)' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'trending', label: 'Trending' },
  { value: 'duration_desc', label: 'Duration (Longer)' },
  { value: 'duration_asc', label: 'Duration (Shorter)' },
]

const DEFAULT_FILTERS = {
  search: '',
  language: '',
  genre: '',
  certification: '',
  release_status: '',
  sort_by: 'release_date_desc',
}

export default function MoviesPage({
  initialSearch = '',
  city = '',
  filterOptions,
  fetchMovies,
  onViewDetails,
  onBook,
}) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, search: initialSearch })
  const [applied, setApplied] = useState({ ...DEFAULT_FILTERS, search: initialSearch })
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFilters((f) => ({ ...f, search: initialSearch }))
    setApplied((f) => ({ ...f, search: initialSearch }))
    setPage(1)
  }, [initialSearch])

  useEffect(() => {
    setPage(1)
  }, [city, applied.language, applied.genre, applied.certification, applied.release_status, applied.sort_by, applied.search])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const isFirstPage = page === 1
      if (isFirstPage) setLoading(true)
      else setLoadingMore(true)
      setError('')
      try {
        const data = await fetchMovies({ ...applied, city, page, page_size: 12 })
        if (cancelled) return
        setItems((prev) => (page === 1 ? (data.items || []) : [...prev, ...(data.items || [])]))
        setTotal(data.total || 0)
        setHasMore(Boolean(data.has_more))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load movies')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [applied, city, page, fetchMovies])

  const languages = filterOptions?.languages || []
  const genres = filterOptions?.genres || []
  const certifications = filterOptions?.certifications || []

  const activeChips = useMemo(() => {
    const chips = []
    if (applied.search) chips.push(`Search: ${applied.search}`)
    if (applied.language) chips.push(`Language: ${applied.language}`)
    if (applied.genre) chips.push(`Genre: ${applied.genre}`)
    if (applied.certification) chips.push(`Certification: ${applied.certification}`)
    if (applied.release_status) chips.push(`Status: ${applied.release_status.replace('_', ' ')}`)
    if (city) chips.push(`City: ${city}`)
    return chips
  }, [applied, city])

  function applyFilters(e) {
    e?.preventDefault()
    setApplied({ ...filters })
    setPage(1)
  }

  function clearFilters() {
    const cleared = { ...DEFAULT_FILTERS, search: '' }
    setFilters(cleared)
    setApplied(cleared)
    setPage(1)
  }

  return (
    <div className="movies-page">
      <div className="page-header-row">
        <div>
          <h1>Movies</h1>
          <p>Discover movies, search, and filter by your preferences.</p>
        </div>
        <div className="result-count">{total} result{total === 1 ? '' : 's'}</div>
      </div>

      <form className="filters-panel" onSubmit={applyFilters}>
        <div className="filters-grid">
          <label>
            <span>Search by movie name</span>
            <input type="text" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Movie name, cast, director..." />
          </label>
          <label>
            <span>Language</span>
            <select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}>
              <option value="">All Languages</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label>
            <span>Genre</span>
            <select value={filters.genre} onChange={(e) => setFilters({ ...filters, genre: e.target.value })}>
              <option value="">All Genres</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label>
            <span>Certification</span>
            <select value={filters.certification} onChange={(e) => setFilters({ ...filters, certification: e.target.value })}>
              <option value="">All Certifications</option>
              {certifications.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span>Release Status</span>
            <select value={filters.release_status} onChange={(e) => setFilters({ ...filters, release_status: e.target.value })}>
              <option value="">All</option>
              <option value="now_showing">Now Showing</option>
              <option value="coming_soon">Coming Soon</option>
            </select>
          </label>
          <label>
            <span>Sort By</span>
            <select value={filters.sort_by} onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn-primary">Apply Filters</button>
          <button type="button" className="btn-secondary" onClick={clearFilters}>Clear Filters</button>
        </div>
      </form>

      {activeChips.length > 0 && (
        <div className="active-filters">{activeChips.map((c) => <span key={c} className="filter-chip">{c}</span>)}</div>
      )}

      {loading ? (
        <div className="page-state">Loading movies...</div>
      ) : error ? (
        <div className="page-state error-state-box"><p>{error}</p><button className="btn-primary" onClick={() => { setPage(1); setApplied({ ...applied }) }}>Retry</button></div>
      ) : items.length === 0 ? (
        <div className="empty-state">No movies found for the selected filters. Try clearing filters or changing search/city.</div>
      ) : (
        <>
          <div className="movie-grid">
            {items.map((movie) => (
              <MovieCard key={movie.movie_id} movie={movie} onViewDetails={onViewDetails} onBook={onBook} />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-wrap">
              <button className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
