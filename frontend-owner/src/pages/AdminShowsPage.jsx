import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAdminShows } from '../services/admin'

function fmtTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

export default function AdminShowsPage() {
  const { token } = useAuth()
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  async function load(p = page) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminShows({ q, status, page: p, page_size: 10 }, token)
      setData(res)
    } catch (err) {
      setError(err.message || 'Could not load shows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1); setPage(1) }, [token])

  function applyFilters(e) {
    e.preventDefault()
    setPage(1)
    load(1)
  }

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 10)))

  return (
    <div className="dash">
      <header className="dash-header">
        <div><h1>Shows</h1><p>Platform-wide show schedule across theatres and screens.</p></div>
        <div className="dash-quick"><button className="btn-secondary" onClick={() => load(page)}>Refresh</button></div>
      </header>

      <section className="panel">
        <form className="filters-row" onSubmit={applyFilters}>
          <input placeholder="Search movie, theatre, screen, owner" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Completed">Completed</option>
          </select>
          <button className="btn-primary" type="submit">Apply</button>
        </form>

        {error && <div className="inline-error">{error}</div>}
        {loading ? (
          <div className="dash-loading">Loading shows...</div>
        ) : data.items.length === 0 ? (
          <div className="empty-state"><p>No shows found.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Movie</th><th>Theatre / Screen</th><th>Owner</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.show_id}>
                      <td>#{s.show_id}</td>
                      <td><strong>{s.movie_name || `Movie #${s.movie_id}`}</strong></td>
                      <td>{s.theatre_name || '-'}<div className="muted small-text">{s.screen_name || '-'}</div></td>
                      <td>{s.owner_name || '-'}</td>
                      <td>{s.show_date}</td>
                      <td>{fmtTime(s.start_time)} - {fmtTime(s.end_time)}</td>
                      <td><span className={`badge ${s.status === 'Scheduled' ? 'badge-blue' : s.status === 'Cancelled' ? 'badge-gray' : 'badge-green'}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span className="muted">Total: {data.total} • Page {data.page} of {totalPages}</span>
              <div className="table-actions">
                <button className="btn-small" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}>Prev</button>
                <button className="btn-small" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(p) }}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
