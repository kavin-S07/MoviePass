import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_SEATS = 10

function fmtTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

function money(n) {
  const num = Number(n || 0)
  return `₹${num.toFixed(2)}`
}

function normalizeGaps(gaps) {
  if (!Array.isArray(gaps)) return new Set()
  return new Set(gaps.map((g) => Number(g)).filter((n) => Number.isFinite(n)))
}

export default function SeatSelectionPage({
  movie,
  show,
  seatLayout,
  selectedSeatIds,
  lockInfo,
  loading,
  error,
  lockError,
  locking,
  onBackToShows,
  onRefresh,
  onToggleSeat,
  onClearSelection,
  onProceedToLock,
  onReleaseLock,
  onLockExpired,
  onContinueToCheckout,
}) {
  const [now, setNow] = useState(Date.now())
  const expiredHandledRef = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const expiresAtMs = lockInfo?.expires_at ? new Date(lockInfo.expires_at).getTime() : null
  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0
  const lockExpired = Boolean(lockInfo && expiresAtMs && remainingMs <= 0)

  useEffect(() => {
    if (lockExpired && !expiredHandledRef.current) {
      expiredHandledRef.current = true
      onLockExpired?.()
    }
    if (!lockExpired) expiredHandledRef.current = false
  }, [lockExpired, onLockExpired])

  const layoutConfig = seatLayout?.layout_config || {}
  const rowLabels = Array.isArray(layoutConfig.row_labels) ? layoutConfig.row_labels : []
  const columnLabels = Array.isArray(layoutConfig.column_labels) ? layoutConfig.column_labels : []
  const rowGaps = useMemo(() => normalizeGaps(layoutConfig.row_gaps), [layoutConfig.row_gaps])
  const colGaps = useMemo(() => normalizeGaps(layoutConfig.column_gaps), [layoutConfig.column_gaps])

  const seatsById = useMemo(() => {
    const map = new Map()
    ;(seatLayout?.seats || []).forEach((s) => map.set(s.seat_id, s))
    return map
  }, [seatLayout])

  const seatsByPos = useMemo(() => {
    const map = new Map()
    ;(seatLayout?.seats || []).forEach((s) => map.set(`${s.row_number}:${s.column_number}`, s))
    return map
  }, [seatLayout])

  const selectedSeats = useMemo(() => {
    return (selectedSeatIds || []).map((id) => seatsById.get(id)).filter(Boolean)
  }, [selectedSeatIds, seatsById])

  const subtotal = useMemo(() => {
    return selectedSeats.reduce((sum, s) => sum + Number(s.category_price || 0), 0)
  }, [selectedSeats])

  const maxRow = seatLayout?.no_of_rows || 0
  const maxCol = seatLayout?.no_of_columns || 0
  const rows = Array.from({ length: maxRow }, (_, i) => i + 1)
  const cols = Array.from({ length: maxCol }, (_, i) => i + 1)

  const categories = seatLayout?.categories || []
  const lockSeatNames = (lockInfo?.seats || []).map((s) => s.seat_name)

  function seatClass(seat) {
    if (!seat) return 'seat-cell empty'
    const isSelected = (selectedSeatIds || []).includes(seat.seat_id)
    const status = seat.availability_status
    if (isSelected) return 'seat-cell selected'
    if (status === 'AVAILABLE') return 'seat-cell available'
    if (status === 'BOOKED') return 'seat-cell booked'
    if (status === 'LOCKED' || status === 'LOCKED_BY_YOU') return 'seat-cell locked'
    if (status === 'INACTIVE') return 'seat-cell inactive'
    return 'seat-cell unavailable'
  }

  function canSelect(seat) {
    if (!seat) return false
    if ((selectedSeatIds || []).includes(seat.seat_id)) return true // allow deselect
    return seat.availability_status === 'AVAILABLE' && seat.is_active
  }

  function handleSeatClick(seat) {
    if (!seat) return
    if (!canSelect(seat) && !(selectedSeatIds || []).includes(seat.seat_id)) return
    if (lockInfo && !lockExpired) return // locked state: selection changes disabled until release/expiry
    onToggleSeat?.(seat, { maxSeats: MAX_SEATS })
  }

  function formatCountdown(ms) {
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (loading && !seatLayout) return <div className="page-state">Loading seat layout...</div>
  if (error && !seatLayout) return <div className="page-state error-state-box"><p>{error}</p><button className="btn-primary" onClick={onRefresh}>Retry</button></div>

  return (
    <div className="seat-selection-page">
      <div className="page-header-row">
        <div>
          <button className="btn-link back-link" onClick={onBackToShows}>← Back to show selection</button>
          <h1>Select Seats</h1>
          <p>{movie?.movie_name || 'Movie'} • {show?.theatre_name || 'Theatre'} • {show?.screen_name || seatLayout?.screen_name || 'Screen'} • {show?.show_date} • {fmtTime(show?.start_time)}-{fmtTime(show?.end_time)}</p>
        </div>
        <div className="seat-page-actions-top">
          <button className="btn-secondary" onClick={onRefresh} disabled={loading}>Refresh Availability</button>
        </div>
      </div>

      {(error || lockError) && (
        <div className="error-state-box inline-alert"><p>{lockError || error}</p></div>
      )}

      <div className="seat-layout-main">
        <section className="seat-map-panel">
          <div className="screen-indicator-wrap">
            <div className="screen-indicator">SCREEN THIS SIDE</div>
          </div>

          <div className="seat-map-scroll">
            <div className="seat-map-grid" role="grid" aria-label="Seat map">
              <div className="seat-map-header-row">
                <div className="row-label-cell" />
                {cols.map((c, idx) => (
                  <div key={`h-${c}`} className="col-label-cell-wrap">
                    <div className="col-label-cell">{columnLabels[c - 1] ?? c}</div>
                    {colGaps.has(c) || colGaps.has(idx + 1) ? <div className="aisle-col-gap" /> : null}
                  </div>
                ))}
              </div>

              {rows.map((r, rIdx) => (
                <div key={`r-${r}`} className="seat-map-row-wrap">
                  <div className="seat-map-row">
                    <div className="row-label-cell">{rowLabels[r - 1] ?? String.fromCharCode(64 + r)}</div>
                    {cols.map((c, idx) => {
                      const seat = seatsByPos.get(`${r}:${c}`)
                      const cls = seatClass(seat)
                      const isSelected = seat ? (selectedSeatIds || []).includes(seat.seat_id) : false
                      const title = seat
                        ? `${seat.seat_name} • ${seat.category_name || 'Standard'} • ${money(seat.category_price)} • ${isSelected ? 'Selected' : seat.availability_status}`
                        : `Row ${r}, Col ${c}`
                      return (
                        <div key={`c-${r}-${c}`} className="seat-cell-wrap">
                          <button
                            type="button"
                            className={cls}
                            onClick={() => handleSeatClick(seat)}
                            disabled={!seat || (!canSelect(seat) && !isSelected) || (!!lockInfo && !lockExpired)}
                            title={title}
                            aria-label={title}
                            style={seat?.category_color && seat.availability_status === 'AVAILABLE' && !isSelected ? { borderColor: seat.category_color } : undefined}
                          >
                            {seat ? seat.seat_name : ''}
                          </button>
                          {colGaps.has(c) || colGaps.has(idx + 1) ? <div className="aisle-col-gap" /> : null}
                        </div>
                      )
                    })}
                  </div>
                  {rowGaps.has(r) || rowGaps.has(rIdx + 1) ? <div className="aisle-row-gap" /> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="seat-legend" aria-label="Seat status legend">
            <span className="legend-item"><i className="seat-swatch available" aria-hidden="true" /> Available</span>
            <span className="legend-item"><i className="seat-swatch selected" aria-hidden="true" /> Selected</span>
            <span className="legend-item"><i className="seat-swatch booked" aria-hidden="true" /> Booked</span>
            <span className="legend-item"><i className="seat-swatch premium" aria-hidden="true" /> Premium</span>
            <span className="legend-item"><i className="seat-swatch unavailable" aria-hidden="true" /> Unavailable</span>
            <span className="legend-item"><i className="seat-swatch locked" aria-hidden="true" /> Temporarily Locked</span>
          </div>

          {categories.length > 0 && (
            <div className="category-legend">
              <h3>Seat Categories & Prices</h3>
              <div className="category-list">
                {categories.map((cat) => (
                  <div key={cat.category_id || cat.category_name} className="category-item">
                    <span className="category-color-dot" style={{ background: cat.color || '#64748b' }} />
                    <span>{cat.category_name}</span>
                    <strong>{money(cat.price)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="booking-summary-panel">
          <h2>Booking Summary</h2>
          <div className="summary-row"><span>Movie</span><strong>{movie?.movie_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Theatre</span><strong>{show?.theatre_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Screen</span><strong>{show?.screen_name || seatLayout?.screen_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Show Date</span><strong>{show?.show_date || 'N/A'}</strong></div>
          <div className="summary-row"><span>Show Time</span><strong>{fmtTime(show?.start_time)} - {fmtTime(show?.end_time)}</strong></div>

          <div className="summary-divider" />
          <div className="summary-row"><span>Selected Seats ({selectedSeats.length}/{MAX_SEATS})</span><strong>{selectedSeats.length ? selectedSeats.map((s) => s.seat_name).join(', ') : 'None'}</strong></div>
          <div className="summary-row"><span>Seat Category</span><strong>{[...new Set(selectedSeats.map((s) => s.category_name || 'Standard'))].join(', ') || 'N/A'}</strong></div>

          <div className="selected-seat-lines">
            {selectedSeats.map((s) => (
              <div key={s.seat_id} className="seat-line-item">
                <span>{s.seat_name} ({s.category_name || 'Standard'})</span>
                <span>{money(s.category_price)}</span>
              </div>
            ))}
          </div>

          <div className="summary-divider" />
          <div className="summary-row"><span>Ticket Price Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="summary-row"><span>Taxes & Fees</span><strong>{lockInfo ? money(Number(lockInfo.subtotal || 0) - subtotal) : 'Calculated by backend at lock/payment'}</strong></div>
          <div className="summary-row total"><span>Estimated/Locked Total</span><strong>{money(lockInfo ? lockInfo.subtotal : subtotal)}</strong></div>

          {lockInfo && (
            <div className={`lock-box ${lockExpired ? 'expired' : ''}`}>
              <p><strong>Seat Lock:</strong> {lockExpired ? 'Expired' : 'Active'}</p>
              <p>Token: <code>{String(lockInfo.lock_token).slice(0, 10)}...</code></p>
              <p>Expires in: <strong>{lockExpired ? '00:00' : formatCountdown(remainingMs)}</strong></p>
              {lockSeatNames.length > 0 && <p>Locked seats: {lockSeatNames.join(', ')}</p>}
            </div>
          )}

          <div className="summary-actions">
            {!lockInfo && (
              <>
                <button className="btn-secondary" type="button" onClick={onClearSelection} disabled={!selectedSeats.length || locking}>Clear Selection</button>
                <button className="btn-primary" type="button" onClick={onProceedToLock} disabled={!selectedSeats.length || locking}>
                  {locking ? 'Locking Seats...' : 'Proceed (Lock Seats)'}
                </button>
              </>
            )}
            {lockInfo && !lockExpired && (
              <>
                <button className="btn-secondary" type="button" onClick={onReleaseLock} disabled={locking}>Release Lock & Edit</button>
                <button className="btn-primary" type="button" onClick={onContinueToCheckout} disabled={locking}>Continue to Checkout</button>
              </>
            )}
            {lockInfo && lockExpired && (
              <>
                <button className="btn-secondary" type="button" onClick={onReleaseLock}>Clear Expired Lock</button>
                <button className="btn-primary" type="button" onClick={onRefresh}>Refresh & Select Again</button>
              </>
            )}
          </div>

          <p className="muted-note">Maximum {MAX_SEATS} seats per booking attempt. Backend lock expiry is authoritative. Taxes/fees are finalized by backend.</p>
        </aside>
      </div>
    </div>
  )
}
