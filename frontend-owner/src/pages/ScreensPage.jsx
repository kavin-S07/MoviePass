import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchTheatres, fetchTheatre } from '../services/theatres'
import { deleteScreen } from '../services/screens'
import { Icon } from '../components/navIcons'

const MAX_DOTS_COLS = 14
const MAX_DOTS_ROWS = 6

// Decorative mini seat map that mirrors the screen's real rows x columns proportions
function MiniSeatMap({ rows, cols }) {

  const r = Math.max(1, Math.min(Number(rows) || 1, MAX_DOTS_ROWS))
  const c = Math.max(1, Math.min(Number(cols) || 1, MAX_DOTS_COLS))

  return (
    <div className="scr-map" aria-hidden="true">
      <div className="scr-map-screen" />
      <div className="scr-map-grid" style={{ gridTemplateColumns: `repeat(${c}, 1fr)` }}>
        {Array.from({ length: r * c }, (_, i) => <span key={i} />)}
      </div>
    </div>
  )
}

function Stat({ label, value, icon }) {

  return (
    <div className="scr-stat">
      <span className="scr-stat-icon"><Icon name={icon} size={18} /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  )
}

// Owner-wide list of screens, grouped by theatre, with a shortcut to add a new one
export default function ScreensPage({ onNavigate, openPicker = false }) {

  const { token } = useAuth()

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [query, setQuery] = useState('')
  const [theatreFilter, setTheatreFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const autoHandled = useRef(false)

  useEffect(() => {

    let cancelled = false

    setLoading(true)
    setError('')

    async function load() {

      try {

        const theatres = await fetchTheatres(token)

        const results = await Promise.allSettled(
          theatres.map((t) => fetchTheatre(t.theatre_id, token))
        )

        if (cancelled) return

        setGroups(theatres.map((theatre, i) => {

          const res = results[i]

          return {
            theatre,
            screens: res.status === 'fulfilled' ? (res.value.screens || []) : [],
            failed: res.status === 'rejected',
          }
        }))

      } catch (err) {

        if (!cancelled) setError(err.message || 'Could not load screens')

      } finally {

        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  function startAdd(theatreId) {

    onNavigate('add-screen', theatreId, { returnTo: 'screens' })
  }

  function handleAddClick() {

    if (groups.length === 1) {
      startAdd(groups[0].theatre.theatre_id)
      return
    }

    if (groups.length > 1) setPickerOpen(true)
  }

  // "Create > Screen" from the navbar / dashboard opens the theatre picker once data is in
  useEffect(() => {

    if (loading || !openPicker || autoHandled.current) return

    autoHandled.current = true

    if (groups.length === 1) startAdd(groups[0].theatre.theatre_id)
    else if (groups.length > 1) setPickerOpen(true)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, openPicker, groups])

  useEffect(() => {

    if (!pickerOpen) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }

    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [pickerOpen])

  async function handleDelete(screen, theatreId) {

    setBusyId(screen.screen_id)
    setError('')

    try {

      await deleteScreen(screen.screen_id, token)

      setGroups((prev) => prev.map((g) => (
        g.theatre.theatre_id === theatreId
          ? { ...g, screens: g.screens.filter((s) => s.screen_id !== screen.screen_id) }
          : g
      )))

      setConfirmId(null)

    } catch (err) {

      setError(err.message || 'Could not delete screen')

    } finally {

      setBusyId(null)
    }
  }

  const totals = useMemo(() => {

    const all = groups.flatMap((g) => g.screens)

    return {
      screens: all.length,
      seats: all.reduce((sum, s) => sum + (Number(s.seat_count) || 0), 0),
      active: all.filter((s) => s.status === 'ACTIVE').length,
    }
  }, [groups])

  const filtersActive = query.trim() !== '' || theatreFilter !== 'ALL' || statusFilter !== 'ALL'

  const visibleGroups = useMemo(() => {

    const q = query.trim().toLowerCase()

    return groups
      .filter((g) => theatreFilter === 'ALL' || String(g.theatre.theatre_id) === theatreFilter)
      .map((g) => ({
        ...g,
        screens: g.screens.filter((s) => {

          if (statusFilter === 'ACTIVE' && s.status !== 'ACTIVE') return false
          if (statusFilter === 'INACTIVE' && s.status === 'ACTIVE') return false

          if (!q) return true

          return (
            String(s.screen_name || '').toLowerCase().includes(q) ||
            String(g.theatre.name || '').toLowerCase().includes(q)
          )
        }),
      }))
      .filter((g) => !filtersActive || g.screens.length > 0)
  }, [groups, query, theatreFilter, statusFilter, filtersActive])

  if (loading) {

    return (
      <div className="scr" aria-busy="true" aria-label="Loading screens">
        <div className="dx-skel dx-skel-hero" />
        <div className="scr-cards">
          {[0, 1, 2].map((i) => <div key={i} className="dx-skel scr-skel-card" />)}
        </div>
      </div>
    )
  }

  const noTheatres = groups.length === 0

  return (
    <div className="scr">
      <header className="scr-head">
        <div>
          <h1>Screens</h1>
          <p>Every screen across your theatres, with its seat capacity and status.</p>
        </div>
        <button
          type="button"
          className="btn-primary dx-btn"
          onClick={handleAddClick}
          disabled={noTheatres}
        >
          <Icon name="plus" size={16} /> Add Screen
        </button>
      </header>

      {error && (
        <div className="scr-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-small" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
        </div>
      )}

      {noTheatres ? (
        <div className="dx-card dx-empty scr-empty">
          <span className="dx-empty-icon"><Icon name="theatres" size={26} /></span>
          <h2>Add a theatre first</h2>
          <p>Screens belong to a theatre. Create your first theatre, then come back to design its screens.</p>
          <button type="button" className="btn-primary" onClick={() => onNavigate('add-theatre')}>
            Add Theatre
          </button>
        </div>
      ) : (
        <>
          <div className="scr-stats">
            <Stat label="Screens" value={totals.screens} icon="screens" />
            <Stat label="Total seats" value={totals.seats.toLocaleString('en-IN')} icon="seat" />
            <Stat label="Active screens" value={totals.active} icon="check" />
          </div>

          <div className="scr-filters">
            <label className="scr-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search screens or theatres"
                aria-label="Search screens or theatres"
              />
            </label>

            <select value={theatreFilter} onChange={(e) => setTheatreFilter(e.target.value)} aria-label="Filter by theatre">
              <option value="ALL">All theatres</option>
              {groups.map((g) => (
                <option key={g.theatre.theatre_id} value={String(g.theatre.theatre_id)}>{g.theatre.name}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="ALL">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {visibleGroups.length === 0 ? (
            <div className="dx-card dx-empty">
              <p>No screens match your filters.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setQuery(''); setTheatreFilter('ALL'); setStatusFilter('ALL') }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            visibleGroups.map(({ theatre, screens, failed }) => (
              <section key={theatre.theatre_id} className="scr-group">
                <div className="scr-group-head">
                  <div className="scr-group-title">
                    <span className="dx-thumb"><Icon name="theatres" size={18} /></span>
                    <div>
                      <h2>{theatre.name}</h2>
                      <span className="scr-group-sub">
                        {theatre.city ? `${theatre.city} · ` : ''}{screens.length} {screens.length === 1 ? 'screen' : 'screens'}
                      </span>
                    </div>
                  </div>
                  <div className="scr-group-actions">
                    <button type="button" className="btn-small" onClick={() => onNavigate('details', theatre.theatre_id)}>
                      View theatre
                    </button>
                    <button type="button" className="btn-small" onClick={() => startAdd(theatre.theatre_id)}>
                      + Add screen
                    </button>
                  </div>
                </div>

                {failed ? (
                  <div className="scr-note">Could not load screens for this theatre.</div>
                ) : screens.length === 0 ? (
                  <div className="scr-note">
                    No screens yet.{' '}
                    <button type="button" className="dx-link" onClick={() => startAdd(theatre.theatre_id)}>
                      Create the first one
                    </button>
                  </div>
                ) : (
                  <div className="scr-cards">
                    {screens.map((screen) => (
                      <article key={screen.screen_id} className="scr-card">
                        <MiniSeatMap rows={screen.no_of_rows} cols={screen.no_of_columns} />

                        <div className="scr-card-body">
                          <div className="scr-card-top">
                            <h3>{screen.screen_name}</h3>
                            <span className={`badge ${screen.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                              {screen.status}
                            </span>
                          </div>

                          <dl className="scr-meta">
                            <div>
                              <dt>Layout</dt>
                              <dd>{screen.no_of_rows} × {screen.no_of_columns}</dd>
                            </div>
                            <div>
                              <dt>Seats</dt>
                              <dd>{screen.seat_count}</dd>
                            </div>
                          </dl>

                          {confirmId === screen.screen_id ? (
                            <div className="scr-confirm" role="group" aria-label={`Delete ${screen.screen_name}?`}>
                              <span>Delete this screen?</span>
                              <button
                                type="button"
                                className="btn-small danger"
                                disabled={busyId === screen.screen_id}
                                onClick={() => handleDelete(screen, theatre.theatre_id)}
                              >
                                {busyId === screen.screen_id ? 'Deleting…' : 'Delete'}
                              </button>
                              <button type="button" className="btn-small" onClick={() => setConfirmId(null)}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="scr-delete"
                              onClick={() => setConfirmId(screen.screen_id)}
                              aria-label={`Delete ${screen.screen_name}`}
                            >
                              <Icon name="trash" size={15} /> Delete
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </>
      )}

      {pickerOpen && (
        <div className="scr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPickerOpen(false) }}>
          <div className="scr-modal" role="dialog" aria-modal="true" aria-labelledby="scr-picker-title">
            <div className="scr-modal-head">
              <div>
                <h2 id="scr-picker-title">Choose a theatre</h2>
                <p>Which theatre should the new screen belong to?</p>
              </div>
              <button type="button" className="scr-modal-close" onClick={() => setPickerOpen(false)} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <ul className="scr-picker">
              {groups.map(({ theatre, screens }) => (
                <li key={theatre.theatre_id}>
                  <button
                    type="button"
                    className="scr-picker-item"
                    onClick={() => { setPickerOpen(false); startAdd(theatre.theatre_id) }}
                  >
                    <span className="dx-thumb"><Icon name="theatres" size={18} /></span>
                    <span className="scr-picker-text">
                      <strong>{theatre.name}</strong>
                      <small>{theatre.city ? `${theatre.city} · ` : ''}{screens.length} {screens.length === 1 ? 'screen' : 'screens'}</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
