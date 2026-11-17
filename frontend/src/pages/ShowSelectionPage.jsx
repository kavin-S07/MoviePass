import { useEffect, useState } from 'react'

function fmtTime(t) {
  if (!t) return ''
  // backend returns HH:MM:SS or HH:MM; show HH:MM
  return String(t).slice(0, 5)
}

export default function ShowSelectionPage({
  movieId,
  city,
  selectedDate,
  selectedShow,
  fetchDiscovery,
  onBackToDetails,
  onDateChange,
  onShowSelect,
  onContinueToSeats,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [theatreSearch, setTheatreSearch] = useState('')
  const [theatreSearchApplied, setTheatreSearchApplied] = useState('')
  const [sortBy, setSortBy] = useState('name_asc')
  const [coords, setCoords] = useState(null)
  const [locStatus, setLocStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = {
          city: city || undefined,
          date: selectedDate || undefined,
          theatre_search: theatreSearchApplied || undefined,
          sort: sortBy,
          ...(sortBy === 'distance' && coords ? { lat: coords.lat, lng: coords.lng } : {}),
        }
        const res = await fetchDiscovery(movieId, params)
        if (cancelled) return
        setData(res)
        // Sync resolved/default selected date from backend if different/unset
        if (res?.selected_date && res.selected_date !== selectedDate) {
          onDateChange(res.selected_date, { syncOnly: true })
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load showtimes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (movieId) load()
    return () => { cancelled = true }
  }, [movieId, city, selectedDate, theatreSearchApplied, sortBy, coords, fetchDiscovery, onDateChange])

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocStatus('Location is not supported in this browser.')
      return
    }
    setLocStatus('Detecting location...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSortBy('distance')
        setLocStatus('Location detected. Sorting by distance where coordinates are available.')
      },
      () => {
        setLocStatus('Location access denied or unavailable. Distance sorting is unavailable.')
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const availableDates = data?.available_dates || []
  const theatres = data?.theatres || []
  const hasSelectableDates = availableDates.some((d) => d.is_selectable)

  return (
    <div className="show-selection-page">
      <div className="page-header-row show-selection-header">
        <div>
          <button className="btn-link back-link" onClick={onBackToDetails}>← Back to movie details</button>
          <h1>Select Theatre, Date & Show</h1>
          <p>{data?.movie?.movie_name || 'Movie'} {city ? `• ${city}` : ''}</p>
        </div>
      </div>

      <section className="selection-panel">
        <div className="selection-panel-top">
          <h2>Date</h2>
          <p className="muted-inline">Select a date to view available theatres and showtimes.</p>
        </div>
        <div className="date-strip" role="tablist" aria-label="Select date">
          {availableDates.length === 0 ? (
            <div className="empty-state inline-empty">No upcoming dates found.</div>
          ) : availableDates.map((d) => {
            const active = (selectedDate || data?.selected_date) === d.date
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={active}
                className={`date-pill ${active ? 'active' : ''} ${!d.is_selectable ? 'disabled' : ''}`}
                disabled={!d.is_selectable}
                onClick={() => d.is_selectable && onDateChange(d.date)}
                title={d.is_selectable ? `${d.show_count} show(s) available` : 'No shows available'}
              >
                <span className="date-label">{d.label}</span>
                <span className="date-sub">{d.is_selectable ? `${d.show_count} shows` : 'No shows'}</span>
              </button>
            )
          })}
        </div>
        {!hasSelectableDates && !loading && (
          <div className="empty-state inline-empty">No bookable shows are available for this movie{city ? ` in ${city}` : ''} on upcoming dates.</div>
        )}
      </section>

      <section className="selection-panel">
        <div className="theatre-filters-row">
          <div className="theatre-filters-left">
            <input
              type="text"
              placeholder="Search theatres by name, area, or city..."
              value={theatreSearch}
              onChange={(e) => setTheatreSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setTheatreSearchApplied(theatreSearch.trim()) }}
            />
            <button className="btn-secondary" type="button" onClick={() => setTheatreSearchApplied(theatreSearch.trim())}>Search</button>
            <button className="btn-secondary" type="button" onClick={() => { setTheatreSearch(''); setTheatreSearchApplied('') }}>Clear</button>
          </div>
          <div className="theatre-filters-right">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name_asc">Sort: Theatre Name (A-Z)</option>
              <option value="name_desc">Sort: Theatre Name (Z-A)</option>
              <option value="shows_desc">Sort: Most Shows</option>
              <option value="distance">Sort: Distance (if available)</option>
            </select>
            <button className="btn-secondary" type="button" onClick={requestLocation}>Use My Location</button>
          </div>
        </div>
        {sortBy === 'distance' && !coords && <p className="muted-note">Enable location to sort theatres by distance (only when reliable coordinates are available).</p>}
        {locStatus && <p className="muted-note">{locStatus}</p>}
      </section>

      {loading ? (
        <div className="page-state">Loading theatres and showtimes...</div>
      ) : error ? (
        <div className="page-state error-state-box"><p>{error}</p><button className="btn-primary" onClick={() => setTheatreSearchApplied((s) => s)}>Retry</button></div>
      ) : !data?.selected_date ? (
        <div className="empty-state">Select a movie/date with available shows to view theatres.</div>
      ) : theatres.length === 0 ? (
        <div className="empty-state">No theatres with matching active shows for the selected date{city ? ` in ${city}` : ''}. Try another date, city, or clear theatre search.</div>
      ) : (
        <div className="theatre-list">
          {theatres.map((theatre) => (
            <section key={theatre.theatre_id} className="theatre-card">
              <div className="theatre-card-header">
                <div>
                  <h3>{theatre.theatre_name}</h3>
                  <p className="theatre-address">{theatre.address}{theatre.city ? `, ${theatre.city}` : ''}{theatre.state ? `, ${theatre.state}` : ''}{theatre.pincode ? ` - ${theatre.pincode}` : ''}</p>
                  <p className="theatre-meta">
                    Status: <strong>{theatre.theatre_status}</strong>
                    {theatre.screens?.length ? ` • Screens: ${theatre.screens.join(', ')}` : ''}
                    {typeof theatre.distance_km === 'number' ? ` • ${theatre.distance_km} km away` : ''}
                  </p>
                </div>
                <div className="theatre-count-badge">{theatre.active_show_count} bookable show{theatre.active_show_count === 1 ? '' : 's'}</div>
              </div>
              <div className="showtimes-wrap">
                {theatre.shows.map((show) => {
                  const isSelected = selectedShow?.show_id === show.show_id
                  const disabled = !show.is_bookable
                  const cls = show.availability_label === 'available' ? 'available' : show.availability_label === 'cancelled' ? 'cancelled' : 'unavailable'
                  return (
                    <button
                      key={show.show_id}
                      type="button"
                      className={`showtime-chip ${cls} ${isSelected ? 'selected' : ''}`}
                      disabled={disabled}
                      onClick={() => { if (disabled) return; onShowSelect(show, theatre); onContinueToSeats?.(show, data?.movie) }}
                      title={disabled ? (show.availability_label === 'cancelled' ? 'Cancelled show cannot be booked' : 'Show unavailable') : `Select ${fmtTime(show.start_time)} show`}
                    >
                      <span className="showtime-time">{fmtTime(show.start_time)} - {fmtTime(show.end_time)}</span>
                      <span className="showtime-sub">{show.screen_name || 'Screen'} • {show.status}</span>
                    </button>
                  )
                })}
              </div>
              <div className="show-legend-row">
                <span className="legend-item"><i className="dot available" /> Available</span>
                <span className="legend-item"><i className="dot unavailable" /> Unavailable</span>
                <span className="legend-item"><i className="dot cancelled" /> Cancelled</span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
