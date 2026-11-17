import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  DEFAULT_SEAT,
  MAX_SEAT,
  MIN_SEAT,
  buildGridTemplate,
  cleanGaps,
  fitSeatSize,
  formatINR,
  gridVars,
  rowLabel,
  seatKey,
} from './seatLayoutUtils'

const MAX_HISTORY = 60

const ARROWS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

// The editable part of the layout. Kept as one object so undo/redo is trivial.
// { assignments: {'r-c': categoryName}, unavailable: Set, removed: Set, vGaps: [], hGaps: [] }
function buildInitialDoc(screen, layout) {

  const { no_of_rows: rows, no_of_columns: cols, categories, has_categories: hasCategories } = screen

  const fallback = hasCategories ? categories[0]?.category_name : 'Standard'

  const assignments = {}

  for (let r = 0; r < rows; r++) {

    for (let c = 0; c < cols; c++) assignments[seatKey(r, c)] = fallback
  }

  const doc = {
    assignments,
    unavailable: new Set(),
    removed: new Set(),
    // centre aisle for wider screens (gap AFTER this 0-based column)
    vGaps: [],
    hGaps: [],
  }

  // Restore an earlier layout (Back from Preview / Back from Step 1)
  const restorable =
    layout &&
    layout.no_of_rows === rows &&
    layout.no_of_columns === cols &&
    Array.isArray(layout.seats)

  if (!restorable) return doc

  const validNames = new Set(categories.map((c) => c.category_name))

  const present = new Set()

  for (const seat of layout.seats) {

    const r = seat.row_number - 1

    const c = seat.column_number - 1

    if (!(r >= 0 && r < rows && c >= 0 && c < cols)) continue

    const key = seatKey(r, c)

    present.add(key)

    if (!seat.is_active) doc.unavailable.add(key)

    if (seat.category && validNames.has(seat.category)) doc.assignments[key] = seat.category
  }

  for (let r = 0; r < rows; r++) {

    for (let c = 0; c < cols; c++) {

      if (!present.has(seatKey(r, c))) doc.removed.add(seatKey(r, c))
    }
  }

  doc.vGaps = cleanGaps(layout.layout_config?.column_gaps, cols)

  doc.hGaps = cleanGaps(layout.layout_config?.row_gaps, rows)

  return doc
}

const SeatCell = memo(function SeatCell({
  r, c, label, category, color, selected, unavailable, tabStop, onDown, onEnter, onKey, onFocusSeat,
}) {

  const classes = ['seat']

  // When our own key handler already toggled the seat, ignore the click the
  // browser may still fire afterwards (Firefox fires one on Space keyup).
  const keyToggledAt = useRef(0)

  if (unavailable) classes.push('seat-unavailable')

  if (selected) classes.push('seat-selected')

  return (
    <button
      type="button"
      className={classes.join(' ')}
      style={unavailable ? undefined : { background: color, borderColor: color }}
      data-seat={seatKey(r, c)}
      tabIndex={tabStop ? 0 : -1}
      aria-pressed={selected}
      aria-label={`Seat ${label}, ${category || 'no category'}${unavailable ? ', unavailable' : ''}`}
      onMouseDown={(e) => onDown(r, c, e)}
      onMouseEnter={() => onEnter(r, c)}
      onKeyDown={(e) => {

        if (e.key === ' ' || e.key === 'Enter') keyToggledAt.current = Date.now()

        onKey(r, c, e)
      }}
      onFocus={() => onFocusSeat(r, c)}
      onClick={(e) => {
        // Mouse presses are handled on mousedown. A click with detail 0 comes from
        // assistive tech or the keyboard; toggle unless the key handler already did.
        if (e.detail === 0 && Date.now() - keyToggledAt.current > 600) {
          onKey(r, c, { key: ' ', preventDefault() {} })
        }
      }}
    >
      {label}
    </button>
  )
})

const RemovedCell = memo(function RemovedCell({ r, c, label, onRestore }) {

  return (
    <button
      type="button"
      tabIndex={-1}
      className="seat-placeholder asw-removed"
      title={`No seat at ${label}. Click to restore it.`}
      aria-label={`Restore seat ${label}`}
      onClick={() => onRestore(r, c)}
    />
  )
})

// Standard seat layout designer.
// Props (unchanged): initialScreen, onSave(payload), onBack().
// Optional additions: initialLayout (a previous payload to restore) and
// onBack(draftPayload), which now receives the current work-in-progress.
export default function SeatDesigner({ initialScreen, initialLayout = null, onSave, onBack }) {

  const {
    screen_name,
    theatre_name,
    no_of_rows,
    no_of_columns,
    categories,
    has_categories,
  } = initialScreen

  const [doc, setDoc] = useState(() => buildInitialDoc(initialScreen, initialLayout))

  const [past, setPast] = useState([])

  const [future, setFuture] = useState([])

  const [selected, setSelected] = useState(() => new Set())

  const [seatSize, setSeatSize] = useState(DEFAULT_SEAT)

  const [focusKey, setFocusKey] = useState(seatKey(0, 0))

  const [status, setStatus] = useState('')

  const [vChoice, setVChoice] = useState('')

  const [hChoice, setHChoice] = useState('')

  const stageRef = useRef(null)

  const dragRef = useRef(null)

  const handlersRef = useRef({})

  // ---- history ----

  function commit(next) {

    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), doc])

    setFuture([])

    setDoc(next)
  }

  function undo() {

    if (!past.length) return

    setFuture((f) => [doc, ...f])

    setDoc(past[past.length - 1])

    setPast(past.slice(0, -1))

    setStatus('Undid the last change.')
  }

  function redo() {

    if (!future.length) return

    setPast((p) => [...p, doc])

    setDoc(future[0])

    setFuture(future.slice(1))

    setStatus('Redid the change.')
  }

  function resetLayout() {

    if (!window.confirm('Reset the layout? Seat categories, unavailable seats, removed seats and aisles go back to their defaults.')) return

    commit(buildInitialDoc(initialScreen, null))

    setSelected(new Set())

    setStatus('Layout reset to defaults.')
  }

  // ---- lookups ----

  const colorMap = useMemo(
    () => new Map(categories.map((cat) => [cat.category_name, cat.color])),
    [categories]
  )

  const colorOf = (name) => colorMap.get(name) || '#94a3b8'

  const allKeys = useMemo(() => {

    const keys = []

    for (let r = 0; r < no_of_rows; r++) {

      for (let c = 0; c < no_of_columns; c++) keys.push(seatKey(r, c))
    }

    return keys

  }, [no_of_rows, no_of_columns])

  const selection = useMemo(
    () => [...selected].filter((k) => !doc.removed.has(k)),
    [selected, doc.removed]
  )

  const firstFree = useMemo(
    () => allKeys.find((k) => !doc.removed.has(k)) || seatKey(0, 0),
    [allKeys, doc.removed]
  )

  const tabKey = doc.removed.has(focusKey) ? firstFree : focusKey

  // ---- selection ----

  const selectAll = () => {

    setStatus('')

    setSelected(new Set(allKeys.filter((k) => !doc.removed.has(k))))
  }

  const clearSelection = () => {

    setStatus('')

    setSelected(new Set())
  }

  const toggleCells = (keys) => {

    if (!keys.length) return

    setStatus('')

    setSelected((prev) => {

      const all = keys.every((k) => prev.has(k))

      const next = new Set(prev)

      keys.forEach((k) => (all ? next.delete(k) : next.add(k)))

      return next
    })
  }

  const selectRow = (r) => {

    const keys = []

    for (let c = 0; c < no_of_columns; c++) {

      if (!doc.removed.has(seatKey(r, c))) keys.push(seatKey(r, c))
    }

    toggleCells(keys)
  }

  const selectColumn = (c) => {

    const keys = []

    for (let r = 0; r < no_of_rows; r++) {

      if (!doc.removed.has(seatKey(r, c))) keys.push(seatKey(r, c))
    }

    toggleCells(keys)
  }

  // click / drag a rectangle. The drag is always "base selection + rectangle",
  // so dragging back shrinks the rectangle again.
  const onSeatDown = (r, c, e) => {

    if (e.button !== 0) return

    e.preventDefault()

    const key = seatKey(r, c)

    if (doc.removed.has(key)) return

    const adding = !selected.has(key)

    dragRef.current = { mode: adding ? 'add' : 'remove', anchor: { r, c }, base: new Set(selected) }

    setStatus('')

    setFocusKey(key)

    setSelected((prev) => {

      const next = new Set(prev)

      if (adding) next.add(key)

      else next.delete(key)

      return next
    })
  }

  const onSeatEnter = (r, c) => {

    const drag = dragRef.current

    if (!drag) return

    const r0 = Math.min(drag.anchor.r, r)

    const r1 = Math.max(drag.anchor.r, r)

    const c0 = Math.min(drag.anchor.c, c)

    const c1 = Math.max(drag.anchor.c, c)

    const next = new Set(drag.base)

    for (let rr = r0; rr <= r1; rr++) {

      for (let cc = c0; cc <= c1; cc++) {

        const key = seatKey(rr, cc)

        if (doc.removed.has(key)) continue

        if (drag.mode === 'add') next.add(key)

        else next.delete(key)
      }
    }

    setSelected(next)
  }

  const onSeatKey = (r, c, e) => {

    if (e.key === ' ' || e.key === 'Enter') {

      e.preventDefault()

      toggleCells([seatKey(r, c)])

      return
    }

    const delta = ARROWS[e.key]

    if (!delta) return

    e.preventDefault()

    let rr = r + delta[0]

    let cc = c + delta[1]

    while (
      rr >= 0 && rr < no_of_rows && cc >= 0 && cc < no_of_columns &&
      doc.removed.has(seatKey(rr, cc))
    ) {

      rr += delta[0]

      cc += delta[1]
    }

    if (rr < 0 || rr >= no_of_rows || cc < 0 || cc >= no_of_columns) return

    const key = seatKey(rr, cc)

    setFocusKey(key)

    if (e.shiftKey) setSelected((prev) => new Set(prev).add(key).add(seatKey(r, c)))

    stageRef.current?.querySelector(`[data-seat="${key}"]`)?.focus()
  }

  // ---- edits (all undoable) ----

  const assignCategory = (categoryName) => {

    if (!selection.length) return

    const assignments = { ...doc.assignments }

    selection.forEach((k) => { assignments[k] = categoryName })

    commit({ ...doc, assignments })

    setStatus(`Assigned ${selection.length} seat${selection.length === 1 ? '' : 's'} to ${categoryName}.`)
  }

  const allSelectedBlocked = selection.length > 0 && selection.every((k) => doc.unavailable.has(k))

  const toggleUnavailable = () => {

    if (!selection.length) return

    const unavailable = new Set(doc.unavailable)

    selection.forEach((k) => (allSelectedBlocked ? unavailable.delete(k) : unavailable.add(k)))

    commit({ ...doc, unavailable })

    setStatus(
      `${selection.length} seat${selection.length === 1 ? '' : 's'} marked ${allSelectedBlocked ? 'available' : 'unavailable'}.`
    )
  }

  const removeSelected = () => {

    if (!selection.length) return

    const removed = new Set(doc.removed)

    const unavailable = new Set(doc.unavailable)

    selection.forEach((k) => {

      removed.add(k)

      unavailable.delete(k)
    })

    commit({ ...doc, removed, unavailable })

    setSelected(new Set())

    setStatus(`Removed ${selection.length} seat${selection.length === 1 ? '' : 's'}. Use Undo to bring them back.`)
  }

  const restoreAll = () => {

    if (!doc.removed.size) return

    commit({ ...doc, removed: new Set() })

    setStatus('Restored all removed seats.')
  }

  const restoreOne = (r, c) => {

    const removed = new Set(doc.removed)

    removed.delete(seatKey(r, c))

    commit({ ...doc, removed })

    setStatus(`Restored seat ${rowLabel(r)}${c + 1}.`)
  }

  const addGap = (axis, value) => {

    if (value === '') return

    const key = axis === 'v' ? 'vGaps' : 'hGaps'

    const next = [...new Set([...doc[key], Number(value)])].sort((a, b) => a - b)

    commit({ ...doc, [key]: next })

    if (axis === 'v') setVChoice('')

    else setHChoice('')
  }

  const removeGap = (axis, value) => {

    const key = axis === 'v' ? 'vGaps' : 'hGaps'

    commit({ ...doc, [key]: doc[key].filter((g) => g !== value) })
  }

  // ---- summary ----

  const summary = useMemo(() => {

    const counts = {}

    categories.forEach((cat) => { counts[cat.category_name] = 0 })

    let blocked = 0

    let active = 0

    for (const key of allKeys) {

      if (doc.removed.has(key)) continue

      if (doc.unavailable.has(key)) {

        blocked++

        continue
      }

      const name = doc.assignments[key]

      if (name && counts[name] !== undefined) counts[name] += 1

      active++
    }

    return { counts, blocked, active, total: active + blocked, removed: doc.removed.size }

  }, [doc, allKeys, categories])

  // ---- payload (same shape as before) ----

  function buildPayload() {

    const seats = []

    for (let r = 0; r < no_of_rows; r++) {

      for (let c = 0; c < no_of_columns; c++) {

        const key = seatKey(r, c)

        if (doc.removed.has(key)) continue

        seats.push({
          seat_name: `${rowLabel(r)}${c + 1}`,
          row_number: r + 1,
          column_number: c + 1,
          category: doc.assignments[key],
          is_active: !doc.unavailable.has(key),
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
        column_gaps: doc.vGaps,
        row_gaps: doc.hGaps,
        sections: [],
      },
    }
  }

  // ---- view size ----

  const fit = () => {

    const el = stageRef.current

    if (!el) return

    setSeatSize(fitSeatSize(el.clientWidth - 32, no_of_columns, doc.vGaps.length))
  }

  useEffect(() => {

    fit()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- global listeners (kept stable via handlersRef) ----

  useEffect(() => {

    handlersRef.current = {
      down: onSeatDown,
      enter: onSeatEnter,
      key: onSeatKey,
      restore: restoreOne,
      undo,
      redo,
      selectAll,
      clear: clearSelection,
      assignIndex: (i) => {

        if (has_categories && categories[i]) assignCategory(categories[i].category_name)
      },
    }
  })

  const stableDown = useCallback((r, c, e) => handlersRef.current.down(r, c, e), [])

  const stableEnter = useCallback((r, c) => handlersRef.current.enter(r, c), [])

  const stableKey = useCallback((r, c, e) => handlersRef.current.key(r, c, e), [])

  const stableRestore = useCallback((r, c) => handlersRef.current.restore(r, c), [])

  const stableFocus = useCallback((r, c) => setFocusKey(seatKey(r, c)), [])

  useEffect(() => {

    const stopDrag = () => { dragRef.current = null }

    const onKeyDown = (e) => {

      const tag = e.target?.tagName

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const h = handlersRef.current

      const mod = e.ctrlKey || e.metaKey

      const k = e.key.toLowerCase()

      if (mod && k === 'z') {

        e.preventDefault()

        if (e.shiftKey) h.redo()

        else h.undo()

        return
      }

      if (mod && k === 'y') {

        e.preventDefault()

        h.redo()

        return
      }

      if (mod && k === 'a') {

        e.preventDefault()

        h.selectAll()

        return
      }

      if (!mod && e.key === 'Escape') {

        h.clear()

        return
      }

      if (!mod && !e.altKey && /^[1-9]$/.test(e.key)) h.assignIndex(Number(e.key) - 1)
    }

    window.addEventListener('mouseup', stopDrag)

    window.addEventListener('keydown', onKeyDown)

    return () => {

      window.removeEventListener('mouseup', stopDrag)

      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // ---- render ----

  const template = buildGridTemplate(no_of_columns, doc.vGaps)

  const vGapSet = new Set(doc.vGaps)

  const hGapSet = new Set(doc.hGaps)

  const vOptions = Array.from({ length: Math.max(no_of_columns - 1, 0) }, (_, i) => i)
    .filter((i) => !vGapSet.has(i))

  const hOptions = Array.from({ length: Math.max(no_of_rows - 1, 0) }, (_, i) => i)
    .filter((i) => !hGapSet.has(i))

  const theatreLabel = theatre_name || 'This theatre'

  return (
    <div className="asw-designer-wrap">
      <header className="dash-header asw-stepheader">
        <div>
          <h1>Edit Layout: {screen_name}</h1>
          <p>
            {theatreLabel} • {no_of_rows} rows × {no_of_columns} columns • {summary.total} seats
            {summary.removed > 0 && ` • ${summary.removed} positions removed`}
          </p>
        </div>
        <span className="muted">Click or drag to select seats, then use the tools.</span>
      </header>

      <div className="asw-designer">
        <aside className="asw-side">

          <section className="panel asw-card" aria-label="Screen summary">
            <h2>Screen summary</h2>

            <dl className="asw-stats">
              <div className="asw-stat">
                <dt>Total seats</dt>
                <dd>{summary.total}</dd>
              </div>
              <div className="asw-stat">
                <dt>Available</dt>
                <dd>{summary.active}</dd>
              </div>
              <div className="asw-stat">
                <dt>Unavailable</dt>
                <dd>{summary.blocked}</dd>
              </div>
            </dl>

            <ul className="asw-catsum">
              {categories.map((cat) => (
                <li key={cat.category_name}>
                  <span className="legend-dot" style={{ background: cat.color }} />
                  <span className="asw-catsum-name">{cat.category_name}</span>
                  <span className="asw-catsum-count">{summary.counts[cat.category_name] || 0}</span>
                  <span className="muted">{formatINR(cat.price)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel asw-card" aria-label="Assign category">
            <div className="asw-card-head">
              <h2>{has_categories ? 'Assign category' : 'Pricing'}</h2>
              <span className="muted">{selection.length} selected</span>
            </div>

            {has_categories ? (
              <>
                <div className="asw-assign">
                  {categories.map((cat, i) => (
                    <button
                      key={cat.category_name}
                      type="button"
                      className="asw-assign-btn"
                      style={{ '--chip': cat.color }}
                      disabled={selection.length === 0}
                      onClick={() => assignCategory(cat.category_name)}
                    >
                      <span className="legend-dot" style={{ background: cat.color }} />
                      <span className="asw-assign-name">{cat.category_name}</span>
                      <span className="muted">{formatINR(cat.price)}</span>
                      {i < 9 && <kbd className="asw-kbd" aria-hidden="true">{i + 1}</kbd>}
                    </button>
                  ))}
                </div>
                <p className="asw-help">
                  {selection.length === 0
                    ? 'Select seats (or click a row letter / column number), then pick a category. Shortcut: press 1–9.'
                    : `Applies to the ${selection.length} selected seat${selection.length === 1 ? '' : 's'}.`}
                </p>
              </>
            ) : (
              <p className="asw-help">
                Every seat uses the single “Standard” category at {formatINR(categories[0]?.price)}.
              </p>
            )}
          </section>

          <section className="panel asw-card" aria-label="Aisles">
            <h2>Aisles</h2>
            <p className="asw-help">Add a walkway between columns or between rows.</p>

            <div className="asw-aisle">
              <label htmlFor="asw-vgap" className="asw-label">Aisle after column</label>
              <div className="asw-aisle-add">
                <select
                  id="asw-vgap"
                  className="asw-input"
                  value={vChoice}
                  disabled={vOptions.length === 0}
                  onChange={(e) => setVChoice(e.target.value)}
                >
                  <option value="">{vOptions.length ? 'Choose…' : 'None available'}</option>
                  {vOptions.map((i) => <option key={i} value={i}>{i + 1}</option>)}
                </select>
                <button type="button" className="asw-tool" disabled={vChoice === ''} onClick={() => addGap('v', vChoice)}>
                  Add
                </button>
              </div>
              <div className="asw-tags">
                {doc.vGaps.length === 0 && <span className="muted">No column aisles</span>}
                {doc.vGaps.map((g) => (
                  <span className="asw-tag" key={g}>
                    After column {g + 1}
                    <button type="button" aria-label={`Remove aisle after column ${g + 1}`} onClick={() => removeGap('v', g)}>✕</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="asw-aisle">
              <label htmlFor="asw-hgap" className="asw-label">Aisle after row</label>
              <div className="asw-aisle-add">
                <select
                  id="asw-hgap"
                  className="asw-input"
                  value={hChoice}
                  disabled={hOptions.length === 0}
                  onChange={(e) => setHChoice(e.target.value)}
                >
                  <option value="">{hOptions.length ? 'Choose…' : 'None available'}</option>
                  {hOptions.map((i) => <option key={i} value={i}>{rowLabel(i)}</option>)}
                </select>
                <button type="button" className="asw-tool" disabled={hChoice === ''} onClick={() => addGap('h', hChoice)}>
                  Add
                </button>
              </div>
              <div className="asw-tags">
                {doc.hGaps.length === 0 && <span className="muted">No row aisles</span>}
                {doc.hGaps.map((g) => (
                  <span className="asw-tag" key={g}>
                    After row {rowLabel(g)}
                    <button type="button" aria-label={`Remove aisle after row ${rowLabel(g)}`} onClick={() => removeGap('h', g)}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          </section>

        </aside>

        <div className="asw-main">

          <div className="panel asw-toolbar" role="toolbar" aria-label="Seat layout tools">
            <div className="asw-tool-group" role="group" aria-label="Selection">
              <button type="button" className="asw-tool" onClick={selectAll}>Select all</button>
              <button type="button" className="asw-tool" onClick={clearSelection} disabled={selection.length === 0}>
                Clear
              </button>
            </div>

            <div className="asw-tool-group" role="group" aria-label="Seat state">
              <button type="button" className="asw-tool" onClick={toggleUnavailable} disabled={selection.length === 0}>
                {allSelectedBlocked ? 'Mark available' : 'Mark unavailable'}
              </button>
              <button type="button" className="asw-tool asw-tool-danger" onClick={removeSelected} disabled={selection.length === 0}>
                Remove seats
              </button>
              {doc.removed.size > 0 && (
                <button type="button" className="asw-tool" onClick={restoreAll}>
                  Restore removed ({doc.removed.size})
                </button>
              )}
            </div>

            <div className="asw-tool-group" role="group" aria-label="History">
              <button type="button" className="asw-tool" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">
                ↶ Undo
              </button>
              <button type="button" className="asw-tool" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
                ↷ Redo
              </button>
              <button type="button" className="asw-tool" onClick={resetLayout}>Reset</button>
            </div>

            <div className="asw-tool-group asw-zoom" role="group" aria-label="View size">
              <label htmlFor="asw-seat-size" className="muted">Seat size</label>
              <input
                id="asw-seat-size"
                type="range"
                min={MIN_SEAT}
                max={MAX_SEAT}
                step="2"
                value={seatSize}
                onChange={(e) => setSeatSize(Number(e.target.value))}
              />
              <button type="button" className="asw-tool" onClick={fit} title="Shrink or grow seats to fit the width">
                Fit
              </button>
            </div>
          </div>

          <p className="asw-status" role="status" aria-live="polite">
            {status || `${selection.length} seat${selection.length === 1 ? '' : 's'} selected`}
          </p>

          <div className="panel asw-stage">
            <div className="asw-stage-scroll" ref={stageRef}>
              <div className="asw-grid" style={gridVars(seatSize)}>

                <div className="seat-row asw-colhead" style={{ gridTemplateColumns: template }}>
                  <span />
                  {Array.from({ length: no_of_columns }, (_, c) => (
                    <Fragment key={c}>
                      <button
                        type="button"
                        className="asw-colbtn"
                        aria-label={`Select column ${c + 1}`}
                        title={`Select column ${c + 1}`}
                        onClick={() => selectColumn(c)}
                      >
                        {c + 1}
                      </button>
                      {vGapSet.has(c) && <span className="seat-gap" aria-hidden="true" />}
                    </Fragment>
                  ))}
                </div>

                {Array.from({ length: no_of_rows }, (_, r) => (
                  <Fragment key={r}>
                    <div className="seat-row" style={{ gridTemplateColumns: template }}>
                      <button
                        type="button"
                        className="row-label asw-rowbtn"
                        aria-label={`Select row ${rowLabel(r)}`}
                        title={`Select row ${rowLabel(r)}`}
                        onClick={() => selectRow(r)}
                      >
                        {rowLabel(r)}
                      </button>

                      {Array.from({ length: no_of_columns }, (_, c) => {

                        const key = seatKey(r, c)

                        const label = `${rowLabel(r)}${c + 1}`

                        return (
                          <Fragment key={key}>
                            {doc.removed.has(key)
                              ? <RemovedCell r={r} c={c} label={label} onRestore={stableRestore} />
                              : (
                                <SeatCell
                                  r={r}
                                  c={c}
                                  label={label}
                                  category={doc.assignments[key]}
                                  color={colorOf(doc.assignments[key])}
                                  selected={selected.has(key)}
                                  unavailable={doc.unavailable.has(key)}
                                  tabStop={key === tabKey}
                                  onDown={stableDown}
                                  onEnter={stableEnter}
                                  onKey={stableKey}
                                  onFocusSeat={stableFocus}
                                />
                              )}
                            {vGapSet.has(c) && <span className="seat-gap" aria-hidden="true" />}
                          </Fragment>
                        )
                      })}
                    </div>

                    {hGapSet.has(r) && r < no_of_rows - 1 && <div className="asw-hgap" aria-hidden="true" />}
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
              {has_categories
                ? categories.map((cat) => (
                  <span className="legend-item" key={cat.category_name}>
                    <span className="legend-dot" style={{ background: cat.color }} />
                    {cat.category_name}
                  </span>
                ))
                : (
                  <span className="legend-item">
                    <span className="legend-dot" style={{ background: categories[0]?.color || '#3b82f6' }} />
                    Available
                  </span>
                )}
              <span className="legend-item"><span className="legend-dot dot-selected" />Selected</span>
              <span className="legend-item"><span className="legend-dot dot-unavailable" />Unavailable (blocked)</span>
              <span className="legend-item"><span className="legend-dot dot-removed" />Removed (no seat)</span>
            </div>
          </div>

          <p className="asw-help asw-shortcuts">
            Tips: drag to select a block · click a row letter or column number to select it · arrow keys move,
            Space selects · Ctrl+Z undo · Esc clears · click a dashed spot to restore a removed seat.
          </p>
        </div>
      </div>

      <div className="asw-actionbar">
        <p className={`asw-hint ${summary.total === 0 ? 'asw-hint-warn' : 'muted'}`}>
          {summary.total === 0
            ? 'There are no seats left. Restore some seats to continue.'
            : summary.active === 0
              ? 'Every seat is unavailable, so customers will not be able to book this screen.'
              : `Step 2 of 3 · ${summary.active} bookable seats across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}.`}
        </p>
        <div className="asw-actionbar-buttons">
          <button type="button" className="btn-secondary" onClick={() => onBack(buildPayload())}>
            ← Back
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={summary.total === 0}
            onClick={() => onSave(buildPayload())}
          >
            Preview &amp; Save →
          </button>
        </div>
      </div>
    </div>
  )
}