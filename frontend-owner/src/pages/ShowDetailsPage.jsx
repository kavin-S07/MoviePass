import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchShowBookingSummary, fetchShowSeats } from '../services/shows'

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

export default function ShowDetailsPage({ showId, onNavigate }) {
  const { token } = useAuth()
  const [summary, setSummary] = useState(null)
  const [seatLayout, setSeatLayout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [sumRes, seatRes] = await Promise.allSettled([
        fetchShowBookingSummary(showId, token),
        fetchShowSeats(showId, token),
      ])
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value)
      else throw sumRes.reason
      if (seatRes.status === 'fulfilled') setSeatLayout(seatRes.value)
      else setError((prev) => prev || seatRes.reason?.message || 'Could not load seat layout')
    } catch (err) {
      setError(err.message || 'Could not load show details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId, token])

  const layoutConfig = seatLayout?.layout_config || {}
  const rowLabels = Array.isArray(layoutConfig.row_labels) ? layoutConfig.row_labels : []
  const columnLabels = Array.isArray(layoutConfig.column_labels) ? layoutConfig.column_labels : []
  const rowGaps = useMemo(() => normalizeGaps(layoutConfig.row_gaps), [layoutConfig.row_gaps])
  const maxRow = seatLayout?.no_of_rows || 0
  const maxCol = seatLayout?.no_of_columns || 0
  const cols = Array.from({ length: maxCol }, (_, i) => i + 1)

  const seatsByPos = useMemo(() => {
    const map = new Map()
    ;(seatLayout?.seats || []).forEach((s) => map.set(`${s.row_number}:${s.column_number}`, s))
    return map
  }, [seatLayout])

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

  const rowAisles = useMemo(() => {
    const set = new Set()
    rowGaps.forEach((g) => {
      if (Number.isInteger(g) && g >= 0 && g <= maxRow - 2) set.add(g + 1)
    })
    return set
  }, [rowGaps, maxRow])

  function seatClass(seat) {
    if (!seat) return 'seat-cell empty'
    const status = seat.availability_status
    if (status === 'AVAILABLE') return 'seat-cell available'
    if (status === 'BOOKED') return 'seat-cell booked'
    if (status === 'LOCKED' || status === 'LOCKED_BY_YOU') return 'seat-cell locked'
    if (status === 'INACTIVE') return 'seat-cell inactive'
    return 'seat-cell unavailable'
  }

  if (loading) return <div className="dash-loading">Loading show details...</div>
  if (error && !summary) return <div className="dash-error"><p>{error}</p><button className="btn-secondary" onClick={() => onNavigate('shows')}>Back to Shows</button></div>

  return (
    <div className="dash show-details-page">
      <header className="dash-header">
        <div>
          <h1>Show Details</h1>
          <p>{summary?.movie_name || 'Show'} • {summary?.theatre_name || 'Theatre'} • {summary?.screen_name || 'Screen'}</p>
        </div>
        <div className="dash-quick">
          <button className="btn-secondary" onClick={() => onNavigate('shows')}>Back to Shows</button>
          <button className="btn-secondary" onClick={load}>Refresh</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {summary && (
        <>
          <section className="panel">
            <div className="panel-head"><h2>Show Information</h2></div>
            <div className="details-grid">
              <div><p>Movie</p><strong>{summary.movie_name || 'N/A'}</strong></div>
              <div><p>Theatre</p><strong>{summary.theatre_name || 'N/A'}</strong></div>
              <div><p>Screen</p><strong>{summary.screen_name || 'N/A'}</strong></div>
              <div><p>Date</p><strong>{summary.show_date || 'N/A'}</strong></div>
              <div><p>Time</p><strong>{fmtTime(summary.start_time)} - {fmtTime(summary.end_time)}</strong></div>
              <div><p>Status</p><strong>{summary.show_status || 'N/A'}</strong></div>
            </div>
          </section>

          <section className="summary-grid" style={{ marginBottom: 0 }}>
            <div className="summary-card tone-blue"><div className="summary-value">{summary.total_seats}</div><div className="summary-label">Total Seats</div></div>
            <div className="summary-card tone-green"><div className="summary-value">{summary.booked_seats}</div><div className="summary-label">Booked / Held Seats</div></div>
            <div className="summary-card tone-amber"><div className="summary-value">{summary.locked_seats}</div><div className="summary-label">Locked Seats</div></div>
            <div className="summary-card tone-violet"><div className="summary-value">{summary.available_seats}</div><div className="summary-label">Available Seats</div></div>
            <div className="summary-card"><div className="summary-value">{summary.confirmed_bookings}</div><div className="summary-label">Confirmed Bookings</div></div>
            <div className="summary-card tone-red"><div className="summary-value">{money(summary.confirmed_revenue)}</div><div className="summary-label">Confirmed Revenue</div></div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Booking Summary</h2></div>
            <div className="details-grid">
              <div><p>Total Bookings</p><strong>{summary.total_bookings}</strong></div>
              <div><p>Confirmed</p><strong>{summary.confirmed_bookings}</strong></div>
              <div><p>Pending / Payment Pending</p><strong>{summary.pending_bookings}</strong></div>
              <div><p>Cancelled / Expired</p><strong>{summary.cancelled_bookings}</strong></div>
              <div><p>Failed</p><strong>{summary.failed_bookings}</strong></div>
              <div><p>Total Amount (all bookings)</p><strong>{money(summary.total_revenue)}</strong></div>
            </div>
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Seat Status</h2>
          <span className="muted">Read-only view of seat availability for this show</span>
        </div>

        {!seatLayout ? (
          <p className="muted">Seat layout unavailable.</p>
        ) : (
          <>
            <div className="seat-legend" style={{ marginBottom: 12 }}>
              <span className="legend-item"><i className="seat-swatch available" aria-hidden="true" /> Available</span>
              <span className="legend-item"><i className="seat-swatch booked" aria-hidden="true" /> Booked</span>
              <span className="legend-item"><i className="seat-swatch locked" aria-hidden="true" /> Locked</span>
              <span className="legend-item"><i className="seat-swatch unavailable" aria-hidden="true" /> Unavailable/Inactive</span>
            </div>

            <div className="seat-map-scroll">
              <div className="seat-map-grid">
                <div className="seat-map-track-row">
                  <div className="seat-track-cell">
                    <div className="col-label-cell row-label-cell" />
                    {cols.map((c) => (
                      <div key={`col-${c}`} className="col-label-cell">{columnLabels[c - 1] ?? c}</div>
                    ))}
                  </div>
                </div>

                {seatRows.map(({ r, empty }) => (
                  <div key={`row-wrap-${r}`} className="seat-map-row-wrap">
                    <div className="seat-map-track-row">
                      <div className="seat-track-cell">
                        <div className="row-label-cell">{rowLabels[r - 1] || `R${r}`}</div>
                        {cols.map((c) => {
                          const seat = seatsByPos.get(`${r}:${c}`)
                          return (
                            <button
                              key={`seat-${r}-${c}`}
                              type="button"
                              className={empty ? 'seat-cell empty' : seatClass(seat)}
                              disabled
                              title={seat ? `${seat.seat_name} • ${seat.category_name || 'Standard'} • ${money(seat.category_price)} • ${seat.availability_status}` : ''}
                            >
                              {!empty && seat ? (seat.seat_name || '') : ''}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {rowAisles.has(r) && <div className="aisle-row-gap" aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
