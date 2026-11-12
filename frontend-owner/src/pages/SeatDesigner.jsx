import { useEffect, useMemo, useState } from 'react'

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function rowLabel(index) {

  if (index < 26) return ROW_LABELS[index]

  // Beyond Z: AA, AB, ...
  const first = Math.floor(index / 26) - 1

  const second = index % 26

  return ROW_LABELS[first] + ROW_LABELS[second]
}

// Standard seat layout designer.
// Renders a cinema layout with aisles, gaps, blocks and categories.
export default function SeatDesigner({ initialScreen, onSave, onBack }) {

  const {
    screen_name,
    theatre_name,
    no_of_rows,
    no_of_columns,
    categories,
    has_categories,
  } = initialScreen

  const [selected, setSelected] = useState(() => new Set())

  const [unavailable, setUnavailable] = useState(() => new Set())

  const [removed, setRemoved] = useState(() => new Set())

  const [assignments, setAssignments] = useState(() => {

    const next = {}

    for (let r = 0; r < no_of_rows; r++) {

      for (let c = 0; c < no_of_columns; c++) {

        next[`${r}-${c}`] = has_categories

          ? categories[0]?.category_name
          : 'Standard'
      }
    }

    return next
  })

  // Where the vertical aisles go (gap inserted AFTER that column, 0-based)
  const [vGaps, setVGaps] = useState(() => {

    const gaps = []

    if (no_of_columns >= 8) gaps.push(Math.floor(no_of_columns / 2) - 1)  // center aisle

    return gaps
  })

  // Where the horizontal aisles go (gap inserted AFTER that row, 0-based)
  const [hGaps, setHGaps] = useState([])

  const [zoom, setZoom] = useState(1)

  const [dragMode, setDragMode] = useState({ active: false, mode: 'add', anchor: null })

  // Stop rectangle-drag on mouseup anywhere
  useEffect(() => {

    const stop = () => setDragMode((d) => (d.active ? { ...d, active: false } : d))

    window.addEventListener('mouseup', stop)

    return () => window.removeEventListener('mouseup', stop)

  }, [])

  const seatKey = (r, c) => `${r}-${c}`

  const isRemoved = (r, c) => removed.has(seatKey(r, c))

  const isUnavailable = (r, c) => unavailable.has(seatKey(r, c))

  const categoryOf = (r, c) => assignments[seatKey(r, c)]

  const colorOf = (categoryName) => {

    const found = categories.find((cat) => cat.category_name === categoryName)

    return found?.color || '#94a3b8'
  }

  const toggleSeat = (r, c) => {

    if (isRemoved(r, c)) return

    const key = seatKey(r, c)

    setSelected((prev) => {

      const next = new Set(prev)

      if (next.has(key)) next.delete(key)

      else next.add(key)

      return next
    })
  }

  const handleSeatMouseDown = (r, c, e) => {

    // Ignore right clicks
    if (e.button !== 0) return

    e.preventDefault()

    if (isRemoved(r, c)) return

    const key = seatKey(r, c)

    const adding = !selected.has(key)

    setDragMode({ active: true, mode: adding ? 'add' : 'remove', anchor: { r, c } })

    // Apply immediately for single-click behaviour
    setSelected((prev) => {

      const next = new Set(prev)

      if (adding) next.add(key)

      else next.delete(key)

      return next
    })
  }

  const handleSeatMouseEnter = (r, c) => {

    if (!dragMode.active || !dragMode.anchor) return

    const { anchor, mode } = dragMode

    const [r0, r1] = [Math.min(anchor.r, r), Math.max(anchor.r, r)]

    const [c0, c1] = [Math.min(anchor.c, c), Math.max(anchor.c, c)]

    setSelected((prev) => {

      const next = new Set(prev)

      for (let rr = r0; rr <= r1; rr++) {

        for (let cc = c0; cc <= c1; cc++) {

          if (removed.has(seatKey(rr, cc))) continue

          const key = seatKey(rr, cc)

          if (mode === 'add') next.add(key)

          else next.delete(key)
        }
      }

      return next
    })
  }

  const selectAll = () => {

    const next = new Set()

    for (let r = 0; r < no_of_rows; r++) {

      for (let c = 0; c < no_of_columns; c++) {

        if (!removed.has(seatKey(r, c))) next.add(seatKey(r, c))
      }
    }

    setSelected(next)
  }

  const clearSelection = () => setSelected(new Set())

  const toggleBlockedSelected = () => {

    if (!selected.size) return

    setUnavailable((prev) => {

      const next = new Set(prev)

      const allBlocked = [...selected].every((s) => next.has(s))

      for (const key of selected) {

        if (allBlocked) next.delete(key)

        else next.add(key)
      }

      return next
    })
  }

  const removeSelected = () => {

    if (!selected.size) return

    if (!confirm(`Remove ${selected.size} seat(s) from the layout?`)) return

    setRemoved((prev) => {

      const next = new Set(prev)

      for (const key of selected) next.add(key)

      return next
    })

    setUnavailable((prev) => {

      const next = new Set(prev)

      for (const key of selected) next.delete(key)

      return next
    })

    setSelected(new Set())
  }

  const restoreRemoved = () => {

    if (!removed.size) return

    setRemoved(new Set())
  }

  const assignCategory = (categoryName) => {

    if (!selected.size) return

    setAssignments((prev) => {

      const next = { ...prev }

      for (const key of selected) {

        if (removed.has(key)) continue

        next[key] = categoryName
      }

      return next
    })
  }

  const summary = useMemo(() => {

    const counts = {}

    categories.forEach((cat) => {

      counts[cat.category_name] = 0
    })

    let blocked = 0

    let active = 0

    for (let r = 0; r < no_of_rows; r++) {

      for (let c = 0; c < no_of_columns; c++) {

        const key = seatKey(r, c)

        if (removed.has(key)) continue

        if (unavailable.has(key)) {

          blocked++

          continue
        }

        const name = assignments[key]

        if (name && counts[name] !== undefined) counts[name] += 1

        active++
      }
    }

    return { counts, blocked, active, total: active + blocked }

  }, [assignments, unavailable, removed, no_of_rows, no_of_columns, categories])

  const toggleVGap = (colIndex) => {

    setVGaps((prev) =>

      prev.includes(colIndex)
        ? prev.filter((g) => g !== colIndex)
        : [...prev, colIndex].sort((a, b) => a - b)
    )
  }

  const toggleHGap = (rowIndex) => {

    setHGaps((prev) =>

      prev.includes(rowIndex)
        ? prev.filter((g) => g !== rowIndex)
        : [...prev, rowIndex].sort((a, b) => a - b)
    )
  }

  function buildPayload(showAll) {

    const labelOf = (index) => rowLabel(index)

    const seats = []

    for (let r = 0; r < no_of_rows; r++) {

      for (let c = 0; c < no_of_columns; c++) {

        const key = seatKey(r, c)

        if (removed.has(key)) continue

        const isActive = !unavailable.has(key)

        const categoryName = assignments[key]

        seats.push({
          seat_name: `${labelOf(r)}${c + 1}`,
          row_number: r + 1,
          column_number: c + 1,
          category: categoryName,
          is_active: isActive,
        })
      }
    }

    return {
      screen_name,
      theatre_name,
      no_of_rows,
      no_of_columns,
      has_categories,
      default_price: has_categories ? null : initialScreen.default_price,
      categories,
      seats,
      layout_config: {
        row_labels: Array.from({ length: no_of_rows }, (_, i) => rowLabel(i)),
        column_labels: Array.from({ length: no_of_columns }, (_, i) => i + 1),
        column_gaps: vGaps,
        row_gaps: hGaps,
        sections: [],
      },
    }
  }

  // Grid columns: label + seats with gaps inserted after given columns
  const gridTemplate = buildGridTemplate(no_of_columns, vGaps)

  return (
    <div className="designer">
      <header className="designer-topbar">
        <div>
          <h1>Edit Layout: {screen_name}</h1>
          <p className="muted">
            {theatre_name} • {no_of_rows} rows × {no_of_columns} columns • {summary.total} positions
          </p>
        </div>

        <div className="designer-topbar-actions">
          <button className="btn-secondary btn-inline" onClick={onBack}>
            ← Back
          </button>
          <button className="btn-primary" onClick={() => onSave(buildPayload(true))}>
            Preview & Save
          </button>
        </div>
      </header>

      <div className="designer-body">
        <aside className="designer-sidebar">
          <div className="panel">
            <div className="panel-head">
              <h2>Screen Summary</h2>
            </div>
            <dl className="designer-meta">
              <div><dt>Total seats</dt><dd>{summary.total}</dd></div>
              <div><dt>Available</dt><dd>{summary.active}</dd></div>
              <div><dt>Unavailable</dt><dd>{summary.blocked}</dd></div>
              {categories.map((cat) => (
                <div key={cat.category_name}>
                  <dt>{cat.category_name}</dt>
                  <dd>{summary.counts[cat.category_name] || 0}</dd>
                </div>
              ))}
            </dl>
          </div>

          {has_categories && (
            <div className="panel">
              <div className="panel-head">
                <h2>Categories</h2>
                <span className="muted">{selected.size} selected</span>
              </div>
              <div className="category-assign">
                {categories.map((cat) => (
                  <button
                    key={cat.category_name}
                    className="category-chip"
                    style={{ '--chip': cat.color }}
                    onClick={() => assignCategory(cat.category_name)}
                  >
                    <span className="chip-swatch" style={{ background: cat.color }} />
                    {cat.category_name}
                    <span className="chip-price">₹{cat.price}</span>
                  </button>
                ))}
              </div>
              {selected.size === 0 && (
                <p className="muted">Select seats to assign a category.</p>
              )}
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>Seat Actions</h2>
            </div>
            <div className="designer-actions">
              <button className="btn-small" onClick={selectAll}>Select All</button>
              <button className="btn-small" onClick={clearSelection}>Clear</button>
              <button className="btn-small" onClick={toggleBlockedSelected}>
                {selected.size && [...selected].every((k) => unavailable.has(k))
                  ? 'Mark Available'
                  : 'Mark Unavailable'}
              </button>
              <button className="btn-small danger" onClick={removeSelected}>Remove Seats</button>
              {removed.size > 0 && (
                <button className="btn-small" onClick={restoreRemoved}>
                  Restore Removed ({removed.size})
                </button>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>View</h2>
            </div>
            <div className="zoom-row">
              <button className="btn-small" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>−</button>
              <input
                type="range"
                min="0.5"
                max="1.6"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <button className="btn-small" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>+</button>
            </div>
          </div>
        </aside>

        <div className="designer-stage">
          <div className="designer-stage-scroll">
            <div className="seat-stage-inner" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
              <div className="screen-indicator">
                <div className="screen-label">{screen_name.toUpperCase()}</div>
                <div className="screen-caption">SCREEN THIS WAY</div>
                <div className="screen-bar" />
              </div>

              {Array.from({ length: no_of_rows }, (_, r) => (
                <div key={r} className="seat-row" style={{ gridTemplateColumns: gridTemplate }}>
                  <div className="row-label">{rowLabel(r)}</div>
                  {Array.from({ length: no_of_columns }, (_, c) => (
                    <SeatCell
                      key={`${r}-${c}`}
                      r={r}
                      c={c}
                      category={categoryOf(r, c)}
                      color={colorOf(categoryOf(r, c))}
                      removed={isRemoved(r, c)}
                      unavailable={isUnavailable(r, c)}
                      selected={selected.has(seatKey(r, c))}
                      onDown={handleSeatMouseDown}
                      onEnter={handleSeatMouseEnter}
                    />
                  ))}
                </div>
              ))}

              <div className="seat-legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: '#94a3b8' }} />Standard / Regular</span>
                {has_categories && categories.map((cat) => (
                  <span className="legend-item" key={cat.category_name}>
                    <span className="legend-dot" style={{ background: cat.color }} />
                    {cat.category_name}
                  </span>
                ))}
                <span className="legend-item"><span className="legend-dot" style={{ background: '#1f2937' }} />Unavailable</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="designer-footer">
        <p className="muted">
          Tip: click to select seats, drag to select a block, then assign a category from the panel.
        </p>
        <div className="button-row">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn-primary" onClick={() => onSave(buildPayload(true))}>
            Preview & Save →
          </button>
        </div>
      </div>
    </div>
  )
}

// Seats are laid out as CSS grid with a custom template string
function buildGridTemplate(cols, vGaps) {

  const gapIndexes = new Set(vGaps)

  const parts = ['40px']

  for (let c = 0; c < cols; c++) {

    parts.push('34px')

    if (gapIndexes.has(c)) parts.push('26px')
  }

  return parts.join(' ')
}

function SeatCell({ r, c, category, color, removed, unavailable, selected, onDown, onEnter }) {

  if (removed) {

    return <div className="seat-placeholder" />
  }

  const classes = ['seat']

  if (unavailable) classes.push('seat-unavailable')

  else if (selected) classes.push('seat-selected')

  const style = unavailable
    ? { background: '#1f2937', color: '#9ca3af', borderColor: '#374151' }
    : { background: color, borderColor: color }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      style={style}
      aria-label={`Seat ${rowLabel(r)}${c + 1}`}
      onMouseDown={(e) => onDown(r, c, e)}
      onMouseEnter={() => onEnter(r, c)}
    >
      {rowLabel(r)}{c + 1}
    </button>
  )
}
