import { useState } from 'react'

import { useAuth } from '../context/AuthContext'

import { createScreen } from '../services/screens'

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function rowLabel(index) {

  if (index < 26) return ROW_LABELS[index]

  const first = Math.floor(index / 26) - 1

  return ROW_LABELS[first] + ROW_LABELS[index % 26]
}

export default function ScreenPreview({ theatreId, payload, onBack, onDone }) {

  const { token } = useAuth()

  const [busy, setBusy] = useState(false)

  const [error, setError] = useState('')

  const seats = payload?.seats || []

  const activeSeats = seats.filter((s) => s.is_active)

  const blockedSeats = seats.filter((s) => !s.is_active)

  const rows = payload?.no_of_rows

  const cols = payload?.no_of_columns

  const categories = payload?.categories || []

  const colorOf = (name) => {

    const found = categories.find((c) => c.category_name === name)

    return found?.color || '#94a3b8'
  }

  const gridTemplate = buildGridTemplate(cols, payload?.layout_config?.column_gaps || [])

  const seatKey = (r, c) => `${r}-${c}`

  // Index seats by row/col for quick lookup
  const seatMap = {}

  for (const seat of seats) {

    seatMap[seatKey(seat.row_number - 1, seat.column_number - 1)] = seat
  }

  const counts = {}

  for (const cat of categories) counts[cat.category_name] = 0

  for (const s of activeSeats) {

    if (s.category && counts[s.category] !== undefined) counts[s.category] += 1
  }

  async function handleSave() {

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

      onDone()

    } catch (err) {

      setError(err.message || 'Could not save the screen')

    } finally {

      setBusy(false)
    }
  }

  return (
    <div className="preview-wrap">
      <header className="designer-topbar">
        <div>
          <h1>Preview: {payload.screen_name}</h1>
          <p className="muted">
            {payload.theatre_name} • {rows} rows × {cols} columns
            • {activeSeats.length} active • {blockedSeats.length} unavailable
          </p>
        </div>

        <div className="designer-topbar-actions">
          <button className="btn-secondary" onClick={onBack} disabled={busy}>
            ← Back to Edit
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving...' : 'Save Screen'}
          </button>
        </div>
      </header>

      <div className="preview-body">
        <div className="screen-indicator">
          <div className="screen-label">{payload.screen_name.toUpperCase()}</div>
          <div className="screen-caption">SCREEN THIS WAY</div>
          <div className="screen-bar" />
        </div>

        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="seat-row" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="row-label">{rowLabel(r)}</div>
            {Array.from({ length: cols }, (_, c) => {

              const seat = seatMap[seatKey(r, c)]

              if (!seat) {

                return <div key={`${r}-${c}`} className="seat-placeholder" />
              }

              const blocked = !seat.is_active

              const bg = blocked ? '#1f2937' : colorOf(seat.category)

              return (
                <div
                  key={`${r}-${c}`}
                  className={`seat ${blocked ? 'seat-unavailable' : ''}`}
                  style={{ background: bg, borderColor: bg, color: blocked ? '#9ca3af' : '#fff' }}
                  title={`${seat.seat_name}${blocked ? ' • unavailable' : ` • ${seat.category || ''}`}`}
                >
                  {seat.seat_name}
                </div>
              )
            })}
          </div>
        ))}

        <div className="seat-legend">
          {categories.map((cat) => (
            <span className="legend-item" key={cat.category_name}>
              <span className="legend-dot" style={{ background: cat.color }} />
              {cat.category_name} ({counts[cat.category_name] || 0})
            </span>
          ))}
          {blockedSeats.length > 0 && (
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#1f2937' }} />
              Unavailable ({blockedSeats.length})
            </span>
          )}
        </div>
      </div>

      {error && <p className="error form-error">{error}</p>}
    </div>
  )
}

function buildGridTemplate(cols, gaps) {

  const gapIndexes = new Set(gaps)

  const parts = ['40px']

  for (let c = 0; c < cols; c++) {

    parts.push('34px')

    if (gapIndexes.has(c)) parts.push('26px')
  }

  return parts.join(' ')
}
