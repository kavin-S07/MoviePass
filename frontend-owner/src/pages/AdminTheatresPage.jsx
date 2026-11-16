import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAdminTheatres } from '../services/admin'

export default function AdminTheatresPage() {
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
      const res = await fetchAdminTheatres({ q, status, page: p, page_size: 10 }, token)
      setData(res)
    } catch (err) {
      setError(err.message || 'Could not load theatres')
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
        <div><h1>Theatres</h1><p>Platform-wide theatre visibility across all owners.</p></div>
      </header>

      <section className="panel">
        <form className="filters-row" onSubmit={applyFilters}>
          <input placeholder="Search theatre, city, owner" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <button className="btn-primary" type="submit">Apply</button>
        </form>

        {error && <div className="inline-error">{error}</div>}
        {loading ? (
          <div className="dash-loading">Loading theatres...</div>
        ) : data.items.length === 0 ? (
          <div className="empty-state"><p>No theatres found.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Theatre</th><th>Owner</th><th>Location</th><th>Contact</th><th>Screens</th><th>Status</th></tr></thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.theatre_id}>
                      <td>#{t.theatre_id}</td>
                      <td><strong>{t.name}</strong><div className="muted small-text">{t.address}</div></td>
                      <td>{t.owner_name || `Owner #${t.owner_id}`}<div className="muted small-text">{t.owner_email || ''}</div></td>
                      <td>{[t.city, t.state].filter(Boolean).join(', ') || '-'}</td>
                      <td>{t.contact_number || '-'}</td>
                      <td>{t.screen_count ?? 0}</td>
                      <td><span className={`badge ${t.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>{t.status}</span></td>
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
