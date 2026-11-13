import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { approveOwner, fetchPendingOwners, rejectOwner } from '../services/auth'

export default function AdminApprovalsPage() {
  const { token } = useAuth()
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPendingOwners(token)
      setOwners(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load pending owners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  async function act(ownerId, type) {
    const label = type === 'approve' ? 'approve' : 'reject'
    if (!window.confirm(`Are you sure you want to ${label} this theatre owner application?`)) return
    setBusyId(ownerId)
    setMessage('')
    setError('')
    try {
      const fn = type === 'approve' ? approveOwner : rejectOwner
      const data = await fn(ownerId, token)
      setMessage(data.message || `Owner ${label}d successfully`)
      await load()
    } catch (err) {
      setError(err.message || `Could not ${label} owner`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Owner Approvals</h1>
          <p>Review and action pending theatre owner applications.</p>
        </div>
        <div className="dash-quick">
          <button className="btn-secondary" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </header>

      {message && <div className="inline-success">{message}</div>}
      {error && <div className="inline-error">{error}</div>}

      <section className="panel">
        {loading ? (
          <div className="dash-loading">Loading pending approvals...</div>
        ) : owners.length === 0 ? (
          <div className="empty-state"><p>No pending theatre owner approvals.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((owner) => (
                  <tr key={owner.user_id}>
                    <td>#{owner.user_id}</td>
                    <td>{owner.name}</td>
                    <td>{owner.email}</td>
                    <td>{owner.phone_no || '-'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-small" disabled={busyId === owner.user_id} onClick={() => act(owner.user_id, 'approve')}>Approve</button>
                        <button className="btn-small danger" disabled={busyId === owner.user_id} onClick={() => act(owner.user_id, 'reject')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
