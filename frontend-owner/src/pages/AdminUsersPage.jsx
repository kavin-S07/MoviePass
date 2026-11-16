import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAdminUsers } from '../services/admin'

export default function AdminUsersPage() {
  const { token } = useAuth()
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  async function load(p = page, overrides = {}) {
    const params = { q, role, approval_status: status, ...overrides, page: p, page_size: 10 }
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminUsers(params, token)
      setData(res)
    } catch (err) {
      setError(err.message || 'Could not load users')
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

  function resetFilters() {
    setQ('')
    setRole('')
    setStatus('')
    setPage(1)
    load(1, { q: '', role: '', approval_status: '' })
  }

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 10)))

  return (
    <div className="dash">
      <header className="dash-header">
        <div><h1>Users</h1><p>Platform users, roles, and approval statuses.</p></div>
      </header>

      <section className="panel">
        <form className="filters-row" onSubmit={applyFilters}>
          <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="THEATRE_OWNER">THEATRE_OWNER</option>
            <option value="TICKET_BOOKER">TICKET_BOOKER</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PENDING">PENDING</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <button className="btn-primary" type="submit">Apply</button>
          <button className="btn-secondary" type="button" onClick={resetFilters}>Reset</button>
        </form>

        {error && <div className="inline-error">{error}</div>}
        {loading ? (
          <div className="dash-loading">Loading users...</div>
        ) : data.items.length === 0 ? (
          <div className="empty-state"><p>No users found.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th></tr></thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.user_id}>
                      <td>#{u.user_id}</td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.phone_no || '-'}</td>
                      <td><span className="badge badge-blue">{u.role}</span></td>
                      <td><span className={`badge ${u.approval_status === 'APPROVED' ? 'badge-green' : u.approval_status === 'PENDING' ? 'badge-blue' : 'badge-gray'}`}>{u.approval_status}</span></td>
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
