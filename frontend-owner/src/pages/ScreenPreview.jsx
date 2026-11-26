import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '../context/AuthContext'

import { createScreen } from '../services/screens'

import {
  buildGridTemplate,
  cleanGaps,
  fitSeatSize,
  formatINR,
  gridVars,
  toDesignPx,
  rowLabel,
  seatKey,
} from './seatLayoutUtils'

const REDIRECT_DELAY_MS = 1600

export default function ScreenPreview({ theatreId, payload, onBack, onDone }) {

  const { token } = useAuth()

  const [confirming, setConfirming] = useState(false)

  const [busy, setBusy] = useState(false)

  const [saved, setSaved] = useState(false)

  const [error, setError] = useState('')

  const [seatSize, setSeatSize] = useState(30)

  const mapRef = useRef(null)

  const timerRef = useRef(null)

  const seats = useMemo(() => (Array.isArray(payload?.seats) ? payload.seats : []), [payload])

  const rows = payload?.no_of_rows || 0

  const cols = payload?.no_of_columns || 0

  const categories = useMemo(() => payload?.categories || [], [payload])

  const vGaps = useMemo(() => cleanGaps(payload?.layout_config?.column_gaps, cols), [payload, cols])

  const hGaps = useMemo(() => cleanGaps(payload?.layout_config?.row_gaps, rows), [payload, rows])

  const stats = useMemo(() => {

    const seatMap = new Map()

    const counts = {}

    categories.forEach((cat) => { counts[cat.category_name] = 0 })

    let active = 0

    let blocked = 0

    for (const seat of seats) {

      seatMap.set(seatKey(seat.row_number - 1, seat.column_number - 1), seat)

      if (!seat.is_active) {

        blocked++

        continue
      }

      active++

      if (seat.category && counts[seat.category] !== undefined) counts[seat.category] += 1
    }

    const revenue = categories.reduce(
      (sum, cat) => sum + (counts[cat.category_name] || 0) * Number(cat.price || 0),
      0
    )

    return { seatMap, counts, active, blocked, revenue }

  }, [seats, categories])

  const colorOf = (name) => categories.find((c) => c.category_name === name)?.color || '#7A7A8C'

  // Fit the seat map to the available width (and keep it fitted on resize)
  useEffect(() => {

    const fit = () => {

      const el = mapRef.current

      if (!el || !cols) return

      setSeatSize(fitSeatSize(toDesignPx(el.clientWidth) - 32, cols, vGaps.length))
    }

    fit()

    window.addEventListener('resize', fit)

    return () => window.removeEventListener('resize', fit)
  }, [cols, vGaps.length])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!payload || seats.length === 0) {

    return (
      <div className="panel asw-empty" role="alert">
        <h2>Nothing to preview</h2>
        <p className="muted">
          {payload
            ? 'This layout has no seats. Go back and restore or add seats.'
            : 'No layout was provided.'}
        </p>
        <button type="button" className="btn-secondary" onClick={onBack}>← Back to Edit</button>
      </div>
    )
  }

  const theatreLabel = payload.theatre_name || `Theatre #${theatreId}`

  const singlePrice = !payload.has_categories

  async function handleSave() {

    if (busy || saved) return

    setBusy(true)

    setError('')

    try {

      const body = {
        screen_name: payload.screen_name,
        screen_number: payload.screen_number ?? null,
        no_of_rows: payload.no_of_rows,
        no_of_columns: payload.no_of_columns,
        has_categories: payload.has_categories,
        default_price: payload.default_price ?? null,
        categories: (payload.categories || []).map((c) => ({
          category_name: c.category_name,
          price: c.price,
          color: c.color,
        })),
        seats: (payload.seats || []).map((s) => ({
          seat_name: s.seat_name,
          row_number: s.row_number,
          column_number: s.column_number,
          category: s.category,
          is_active: s.is_active,
        })),
        layout_config: payload.layout_config,
      }

      await createScreen(theatreId, body, token)

      setSaved(true)

      setConfirming(false)

      timerRef.current = setTimeout(() => onDone(), REDIRECT_DELAY_MS)

    } catch (err) {

      setError(err.message || 'Could not save the screen')

      // keep the confirmation open so "Retry" is one click away
      setConfirming(true)

    } finally {

      setBusy(false)
    }
  }

  function goNow() {

    clearTimeout(timerRef.current)

    onDone()
  }

  const template = buildGridTemplate(cols, vGaps)

  const vGapSet = new Set(vGaps)

  const hGapSet = new Set(hGaps)

  return (
    <div className="asw-preview">
      <header className="dash-header asw-stepheader">
        <div>
          <h1>Preview: {payload.screen_name}</h1>
          <p>Review everything below. Nothing is saved until you confirm.</p>
        </div>
      </header>

      {saved && (
        <div className="asw-banner asw-banner-ok" role="status">
          <div>
            <strong>Screen saved.</strong> “{payload.screen_name}” was added to {theatreLabel}. Taking you back to the theatre…
          </div>
          <button type="button" className="btn-secondary asw-btn-sm" onClick={goNow}>Go now</button>
        </div>
      )}

      {error && (
        <div className="asw-banner asw-banner-err" role="alert">
          <div><strong>Could not save the screen.</strong> {error}</div>
        </div>
      )}

      {!saved && stats.active === 0 && (
        <div className="asw-banner asw-banner-warn" role="status">
          Every seat is unavailable, so customers will not be able to book this screen. You can still save it and change this later.
        </div>
      )}

      <dl className="asw-stats-row" aria-label="Screen summary">
        <div className="asw-stat"><dt>Screen</dt><dd className="asw-stat-text">{payload.screen_name}</dd></div>
        <div className="asw-stat"><dt>Grid</dt><dd>{rows} × {cols}</dd></div>
        <div className="asw-stat"><dt>Total seats</dt><dd>{seats.length}</dd></div>
        <div className="asw-stat"><dt>Bookable</dt><dd>{stats.active}</dd></div>
        <div className="asw-stat"><dt>Unavailable</dt><dd>{stats.blocked}</dd></div>
      </dl>

      <div className="asw-preview-layout">

        <section className="panel asw-card asw-preview-info" aria-label="Details and pricing">
          <div className="asw-info-col">
            <h2>Details</h2>

            <dl className="asw-kv">
            <div><dt>Theatre</dt><dd>{theatreLabel}</dd></div>
            <div><dt>Screen number</dt><dd>{payload.screen_number ?? '—'}</dd></div>
            <div>
              <dt>Pricing</dt>
              <dd>{singlePrice ? `Single price, ${formatINR(payload.default_price)}` : `${categories.length} categories`}</dd>
            </div>
            <div><dt>Aisles</dt><dd>{vGaps.length} column, {hGaps.length} row</dd></div>
            </dl>
          </div>

          <div className="asw-info-col">
          <h2>Categories &amp; pricing</h2>

          <div className="table-wrap">
            <table className="asw-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="asw-num">Price</th>
                  <th scope="col" className="asw-num">Seats</th>
                  <th scope="col" className="asw-num">Full house</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {

                  const count = stats.counts[cat.category_name] || 0

                  return (
                    <tr key={cat.category_name}>
                      <th scope="row">
                        <span className="legend-dot" style={{ background: cat.color }} />
                        {cat.category_name}
                      </th>
                      <td className="asw-num">{formatINR(cat.price)}</td>
                      <td className="asw-num">{count}</td>
                      <td className="asw-num">{formatINR(count * Number(cat.price || 0))}</td>
                    </tr>
                  )
                })}
                {stats.blocked > 0 && (
                  <tr>
                    <th scope="row">
                      <span className="legend-dot dot-unavailable" />
                      Unavailable
                    </th>
                    <td className="asw-num">—</td>
                    <td className="asw-num">{stats.blocked}</td>
                    <td className="asw-num">—</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td />
                  <td className="asw-num">{seats.length}</td>
                  <td className="asw-num">{formatINR(stats.revenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="asw-help">“Full house” is the ticket value if every bookable seat is sold once.</p>
          </div>
        </section>

        <section className="panel asw-stage asw-preview-map" aria-label="Seat map">
          <div className="asw-stage-scroll" ref={mapRef}>
            <div
              className="asw-grid"
              style={gridVars(seatSize)}
              role="img"
              aria-label={`Seat map for ${payload.screen_name}: ${rows} rows, ${cols} columns, ${stats.active} bookable seats`}
            >
              <div className="seat-row asw-colhead" style={{ gridTemplateColumns: template }}>
                <span />
                {Array.from({ length: cols }, (_, c) => (
                  <Fragment key={c}>
                    <span className="asw-colnum">{c + 1}</span>
                    {vGapSet.has(c) && <span className="seat-gap" />}
                  </Fragment>
                ))}
              </div>

              {Array.from({ length: rows }, (_, r) => (
                <Fragment key={r}>
                  <div className="seat-row" style={{ gridTemplateColumns: template }}>
                    <div className="row-label">{rowLabel(r)}</div>

                    {Array.from({ length: cols }, (_, c) => {

                      const seat = stats.seatMap.get(seatKey(r, c))

                      const blocked = seat && !seat.is_active

                      return (
                        <Fragment key={c}>
                          {!seat
                            ? <div className="seat-placeholder" />
                            : (
                              <div
                                className={`seat seat-static ${blocked ? 'seat-unavailable' : ''}`}
                                style={blocked ? undefined : { background: colorOf(seat.category), borderColor: colorOf(seat.category) }}
                                title={`${seat.seat_name}${blocked ? ' • unavailable' : ` • ${seat.category || ''}`}`}
                              >
                                {seat.seat_name}
                              </div>
                            )}
                          {vGapSet.has(c) && <span className="seat-gap" />}
                        </Fragment>
                      )
                    })}
                  </div>

                  {hGapSet.has(r) && r < rows - 1 && <div className="asw-hgap" />}
                </Fragment>
              ))}


              <div className="asw-screen asw-screen-bottom" aria-label="Movie screen position">
                <div className="asw-screen-curve" />
                <div className="asw-screen-label">MOVIE SCREEN</div>
                <div className="screen-caption">All seats face this way</div>
              </div>
            </div>
          </div>

          <div className="seat-legend asw-legend" aria-label="Legend">
            {categories.map((cat) => (
              <span className="legend-item" key={cat.category_name}>
                <span className="legend-dot" style={{ background: cat.color }} />
                {cat.category_name} ({stats.counts[cat.category_name] || 0})
              </span>
            ))}
            {stats.blocked > 0 && (
              <span className="legend-item">
                <span className="legend-dot dot-unavailable" />
                Unavailable ({stats.blocked})
              </span>
            )}
            {seats.length < rows * cols && (
              <span className="legend-item">
                <span className="legend-dot dot-removed" />
                No seat ({rows * cols - seats.length})
              </span>
            )}
          </div>
        </section>
      </div>

      {confirming && !saved && (
        <div className="asw-confirm" role="alertdialog" aria-labelledby="asw-confirm-title">
          <div>
            <strong id="asw-confirm-title">
              {error ? 'Try saving again?' : `Save “${payload.screen_name}” to ${theatreLabel}?`}
            </strong>
            <p className="muted">
              This creates a screen with {seats.length} seats ({stats.active} bookable). You can’t edit the layout from here afterwards.
            </p>
          </div>
          <div className="asw-actionbar-buttons">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setConfirming(false); setError('') }}>
              Keep editing
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={handleSave}>
              {busy ? 'Saving…' : error ? 'Retry save' : 'Confirm & save'}
            </button>
          </div>
        </div>
      )}

      <div className="asw-actionbar">
        <p className="muted asw-hint">Step 3 of 3 · Nothing is saved until you confirm.</p>
        <div className="asw-actionbar-buttons">
          <button type="button" className="btn-secondary" onClick={onBack} disabled={busy || saved}>
            ← Back to Edit
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || saved || confirming}
            onClick={() => { setError(''); setConfirming(true) }}
          >
            {saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save Screen'}
          </button>
        </div>
      </div>
    </div>
  )
}