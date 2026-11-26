import { useEffect, useMemo, useRef, useState } from 'react'
import SeatLockReminderPopup from './SeatLockReminderPopup'
import LockTimer, { formatCountdown, useLockCountdown } from '../components/LockTimer'

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
  lockReminderOpen = false,
  closeLockReminder,
}) {
  const [summaryOpen, setSummaryOpen] = useState(false)
  const expiredHandledRef = useRef(false)

  // Booking summary popup: close on Escape (unless busy) and lock page scroll while open.
  useEffect(() => {
    if (!summaryOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape' && !locking) setSummaryOpen(false) }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [summaryOpen, locking])

  const { remainingMs, expired: lockExpired } = useLockCountdown(lockInfo?.expires_at)

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

  // Row aisles only (clamped to valid interior positions). Column aisles are intentionally not rendered
  // so seats in a row stay evenly spaced.
  const rowAisles = useMemo(() => {
    const set = new Set()
    rowGaps.forEach((g) => {
      if (Number.isInteger(g) && g >= 0 && g <= maxRow - 2) set.add(g + 1)
    })
    return set
  }, [rowGaps, maxRow])

  // All rows in order. Rows with no seats at all are rendered as a small spacer (aisle).
  const seatRows = useMemo(() => {
    const out = []
    for (let r = 1; r <= maxRow; r += 1) {
      let has = false
      for (let c = 1; c <= maxCol; c += 1) {
        if (seatsByPos.has(`${r}:${c}`)) { has = true; break }
      }
      out.push({ r, empty: !has })
    }
    return out
  }, [seatsByPos, maxRow, maxCol])

  // Close the popup if there is nothing left to summarise.
  useEffect(() => {
    if (summaryOpen && !selectedSeats.length && !lockInfo) setSummaryOpen(false)
  }, [summaryOpen, selectedSeats.length, lockInfo])

  if (loading && !seatLayout) return <div className="page-state">Loading seat layout...</div>
  if (error && !seatLayout) return <div className="page-state error-state-box"><p>{error}</p><button className="btn-primary" onClick={onRefresh}>Retry</button></div>

  return (
      <div className="seat-selection-page">
      {lockReminderOpen && lockInfo && !lockExpired && (
        <SeatLockReminderPopup
          expiresAt={lockInfo.expires_at}
          onClose={() => closeLockReminder?.()}
          onComplete={onContinueToCheckout}
        />
      )}
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

      <div className="seat-total-bar">
        <div className="seat-total-info">
          <span className="seat-total-label">Total Amount</span>
          <strong className="seat-total-amount">{money(lockInfo ? lockInfo.subtotal : subtotal)}</strong>
        </div>
        <div className="seat-total-seats">
          <span>{selectedSeats.length} / {MAX_SEATS} seats</span>
          <small>{selectedSeats.length ? selectedSeats.map((s) => s.seat_name).join(', ') : 'No seats selected'}</small>
        </div>
        {lockInfo && <LockTimer expiresAt={lockInfo.expires_at} />}
        <div className="seat-total-actions">
          {!lockInfo && selectedSeats.length > 0 && (
            <button className="btn-secondary" type="button" onClick={onClearSelection} disabled={locking}>Clear</button>
          )}
          <button className="btn-primary" type="button" onClick={() => setSummaryOpen(true)} disabled={!selectedSeats.length && !lockInfo}>Continue</button>
        </div>
      </div>

      {(error || lockError) && (
        <div className="error-state-box inline-alert"><p>{lockError || error}</p></div>
      )}

      <div className="seat-layout-main">
        <section className="seat-map-panel">
          <div className="seat-map-scroll">
            <div className="seat-stage">
              <div className="seat-map-grid" role="grid" aria-label="Seat map">
                <div className="seat-map-track-row seat-map-header-row" role="row">
                  <div className="row-label-cell" aria-hidden="true" />
                  {cols.map((c) => (
                    <div key={`track-h-${c}`} className="seat-track-cell">
                      <div className="col-label-cell">{columnLabels[c - 1] ?? c}</div>
                    </div>
                  ))}
                </div>

                {seatRows.map(({ r, empty }) => (empty ? (
                  <div key={`track-r-${r}`} className="seat-row-spacer" aria-hidden="true" />
                ) : (
                  <div key={`track-r-${r}`} className="seat-map-row-wrap">
                    <div className="seat-map-track-row seat-map-row" role="row">
                      <div className="row-label-cell">{rowLabels[r - 1] ?? String.fromCharCode(64 + r)}</div>
                      {cols.map((c) => {
                        const seat = seatsByPos.get(`${r}:${c}`)
                        const cls = seatClass(seat)
                        const isSelected = seat ? (selectedSeatIds || []).includes(seat.seat_id) : false
                        const title = seat
                          ? `${seat.seat_name} • ${seat.category_name || 'Standard'} • ${money(seat.category_price)} • ${isSelected ? 'Selected' : seat.availability_status}`
                          : `Row ${r}, Col ${c}`
                        return (
                          <div key={`track-c-${r}-${c}`} className="seat-track-cell">
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
                          </div>
                        )
                      })}
                    </div>
                    {rowAisles.has(r) ? <div className="aisle-row-gap" aria-hidden="true" /> : null}
                  </div>
                )))}
              </div>

              <div className="screen-indicator-wrap" aria-hidden="true">
                <div className="screen-indicator" />
                <span className="screen-label">MOVIE SCREEN</span>
                <span className="screen-sub">All seats face this way</span>
              </div>
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
      </div>

      {summaryOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !locking) setSummaryOpen(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="booking-summary-title">
            <div className="modal-head">
              <h2 id="booking-summary-title">Booking Summary</h2>
              <button type="button" className="modal-close" aria-label="Close booking summary" onClick={() => setSummaryOpen(false)} disabled={locking}>×</button>
            </div>

            <div className="modal-body">
            {lockError && <div className="error-state-box inline-alert"><p>{lockError}</p></div>}

            {lockInfo && (
              <div className={`lock-box ${lockExpired ? 'expired' : ''}`}>
                <div className="lock-box-head">
                  <span className="lock-box-status">{lockExpired ? 'Seat hold expired' : 'Seats locked for you'}</span>
                  <LockTimer expiresAt={lockInfo.expires_at} />
                </div>
                {lockSeatNames.length > 0 && <p className="lock-box-seats">Locked seats: <strong>{lockSeatNames.join(', ')}</strong></p>}
              </div>
            )}

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

            </div>

            <div className="modal-footer">
            <div className="modal-actions">
              {!lockInfo && (
                <>
                  <button className="btn-secondary" type="button" onClick={() => setSummaryOpen(false)} disabled={locking}>Edit Seats</button>
                  <button className="btn-primary" type="button" onClick={onProceedToLock} disabled={!selectedSeats.length || locking}>
                    {locking ? 'Locking Seats...' : 'Proceed (Lock Seats)'}
                  </button>
                </>
              )}
              {lockInfo && !lockExpired && (
                <>
                  <button className="btn-secondary" type="button" onClick={() => Promise.resolve(onReleaseLock?.()).finally(() => setSummaryOpen(false))} disabled={locking}>Release Lock & Edit</button>
                  <button className="btn-primary" type="button" onClick={onContinueToCheckout} disabled={locking}>Continue to Checkout</button>
                </>
              )}
              {lockInfo && lockExpired && (
                <>
                  <button className="btn-secondary" type="button" onClick={() => Promise.resolve(onReleaseLock?.()).finally(() => setSummaryOpen(false))}>Clear Expired Lock</button>
                  <button className="btn-primary" type="button" onClick={() => { onRefresh?.(); setSummaryOpen(false) }}>Refresh & Select Again</button>
                </>
              )}
            </div>

            <p className="muted-note">Maximum {MAX_SEATS} seats per booking attempt. Taxes/fees are finalized by the backend.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
