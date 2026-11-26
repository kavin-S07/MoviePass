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
  format: '',
}

// District-style horizontal filters. Chips are wired to the real filtering
// state where API data exists (language, release status); "3D"/"IMAX 2D"
// apply to a `format` field on movie data when the backend provides one.
const HORIZONTAL_FILTERS = ['Tamil', 'English', 'New Releases', 'Re-Releases', '3D', 'IMAX 2D']

function horizontalChipConfig(label, languages) {
  switch (label) {
    case 'Tamil': return { key: 'language', value: 'Tamil', enabled: languages.includes('Tamil') }
    case 'English': return { key: 'language', value: 'English', enabled: languages.includes('English') }
    case 'New Releases': return { key: 'release_status', value: 'now_showing', enabled: true }
    case 'Re-Releases': return { key: 'release_status', value: 'now_showing', enabled: true }
    default: return { key: 'format', value: label, enabled: true }
  }
}

function horizontalChipActive(key, value, applied) {
  return key === 'format'
    ? applied.format === value
    : applied[key] === value
}

export default function MoviesPage({
  initialSearch = '',
  city = '',
  filterOptions,
  fetchMovies,
  onViewDetails,
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
  const [sheetOpen, setSheetOpen] = useState(false) // UI only: mobile filter bottom-sheet

  useEffect(() => {
    setFilters((f) => ({ ...f, search: initialSearch }))
    setApplied((f) => ({ ...f, search: initialSearch }))
    setPage(1)
  }, [initialSearch])

  useEffect(() => {
    setPage(1)
  }, [city, applied.language, applied.genre, applied.certification, applied.release_status, applied.format, applied.sort_by, applied.search])

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

  const hasFormatData = items.some((m) => m.format)
  const formatActive = applied.format || ''
  const displayItems = useMemo(() => {
    if (!formatActive || !hasFormatData) return items
    return items.filter((m) => (m.format || '') === formatActive)
  }, [items, formatActive, hasFormatData])

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
    setSheetOpen(false)
  }

  // Mobile quick-filter chips: toggle one filter and apply immediately (same state + fetch path as the form).
  function toggleQuick(key, value) {
    const next = { ...applied, [key]: applied[key] === value ? '' : value }
    setFilters(next)
    setApplied(next)
    setPage(1)
  }

  useEffect(() => {
    if (!sheetOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const filterCount = [applied.search, applied.language, applied.genre, applied.certification, applied.release_status].filter(Boolean).length

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
          <h1>All Movies</h1>
          <p>Discover movies, search, and filter by your preferences.</p>
        </div>
        <div className="result-count">{total} result{total === 1 ? '' : 's'}</div>
      </div>

      <div className="movies-filter-row" role="toolbar" aria-label="Movie filters">
        <button type="button" className="movies-filters-dropdown-btn" onClick={() => setSheetOpen(true)} aria-label="Open full filters">
          Filters
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z" /></svg>
        </button>
        <div className="movies-filter-chips">
          {HORIZONTAL_FILTERS.map((label) => {
            const cfg = horizontalChipConfig(label, languages)
            if (!cfg.enabled) return null
            const active = horizontalChipActive(cfg.key, cfg.value, applied)
            return (
              <button key={label} type="button" className={`movies-filter-chip ${active ? 'active' : ''}`} onClick={() => toggleQuick(cfg.key, cfg.value)} aria-pressed={active}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="quick-filter-bar" role="toolbar" aria-label="Quick filters">
        <button type="button" className={`quick-filter-btn ${filterCount ? 'has-active' : ''}`} onClick={() => setSheetOpen(true)} aria-label="Open filters">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4L3 5z" /></svg>
          {filterCount > 0 && <span className="quick-filter-count">{filterCount}</span>}
        </button>
        <div className="quick-chips">
          {[['release_status', 'now_showing', 'Now Showing'], ['release_status', 'coming_soon', 'Coming Soon']].map(([k, v, label]) => (
            <button key={v} type="button" className={`quick-chip ${applied[k] === v ? 'active' : ''}`} onClick={() => toggleQuick(k, v)}>{label}</button>
          ))}
          {languages.map((l) => (
            <button key={`l-${l}`} type="button" className={`quick-chip ${applied.language === l ? 'active' : ''}`} onClick={() => toggleQuick('language', l)}>{l}</button>
          ))}
          {genres.map((g) => (
            <button key={`g-${g}`} type="button" className={`quick-chip ${applied.genre === g ? 'active' : ''}`} onClick={() => toggleQuick('genre', g)}>{g}</button>
          ))}
        </div>
      </div>

      {sheetOpen && <div className="filter-sheet-backdrop" onClick={() => setSheetOpen(false)} aria-hidden="true" />}
      <form className={`filters-panel ${sheetOpen ? 'sheet-open' : ''}`} onSubmit={applyFilters}>
        <div className="filter-sheet-head">
          <strong>Filters</strong>
          <button type="button" className="modal-close" onClick={() => setSheetOpen(false)} aria-label="Close filters">×</button>
        </div>
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
            {displayItems.map((movie) => (
              <MovieCard key={movie.movie_id} movie={movie} onViewDetails={onViewDetails} />
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
