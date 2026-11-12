import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'

import { fetchPendingOwners, approveOwner, rejectOwner } from '../services/auth'

import logo from '../assets/logo.jpeg'

export default function AdminDashboard() {

  const { token, logout } = useAuth()

  const [pendingOwners, setPendingOwners] = useState([])

  const [message, setMessage] = useState('')

  async function loadPendingOwners(accessToken = token) {

    try {

      const data = await fetchPendingOwners(accessToken)

      setPendingOwners(data)

      setMessage('')

    } catch (err) {

      setMessage(err.message || 'Could not load pending owners')
    }
  }

  async function approve(ownerId) {

    try {

      const data = await approveOwner(ownerId, token)

      setMessage(data.message || 'Approved')

      loadPendingOwners()

    } catch (err) {

      setMessage(err.message || 'Could not approve owner')
    }
  }

  async function reject(ownerId) {

    try {

      const data = await rejectOwner(ownerId, token)

      setMessage(data.message || 'Rejected')

      loadPendingOwners()

    } catch (err) {

      setMessage(err.message || 'Could not reject owner')
    }
  }

  useEffect(() => {

    loadPendingOwners(token)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="card wide">
      <img src={logo} className="logo-img" alt="MoviePass" />
      <h1>Admin - Pending Theatre Owner Approvals</h1>

      {message && <p className="success">{message}</p>}

      {pendingOwners.length === 0 ? (
        <p>No pending approvals.</p>
      ) : (
        <ul className="owner-list">
          {pendingOwners.map((owner) => (
            <li key={owner.user_id}>
              <div className="owner-row">
                <div>
                  <strong>{owner.name}</strong>
                  <br />
                  <small>
                    {owner.email}{owner.phone_no ? ` • ${owner.phone_no}` : ''}
                  </small>
                </div>
                <div className="owner-actions">
                  <button onClick={() => approve(owner.user_id)}>Approve</button>
                  <button className="danger" onClick={() => reject(owner.user_id)}>Reject</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="button-row">
        <button onClick={() => loadPendingOwners(token)}>Refresh</button>
        <button className="danger" onClick={logout}>Logout</button>
      </div>
    </div>
  )
}
