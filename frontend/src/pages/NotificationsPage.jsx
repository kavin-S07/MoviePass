import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications'

export default function NotificationsPage({ onUnreadChange }) {
  const { token } = useAuth()
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetchNotifications(token)
      setItems(res.notifications || [])
      setUnread(res.unread_count || 0)
      onUnreadChange?.(res.unread_count || 0)
    } catch (e) { setError(e.message || 'Failed to load notifications') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  async function markOne(id) {
    try {
      await markNotificationRead(id, token)
      await load()
    } catch (e) { setError(e.message || 'Failed to mark notification as read') }
  }

  async function markAll() {
    try {
      const res = await markAllNotificationsRead(token)
      setUnread(res.unread_count || 0)
      onUnreadChange?.(res.unread_count || 0)
      await load()
    } catch (e) { setError(e.message || 'Failed to mark all as read') }
  }

  return (
    <div className="page-container notifications-page">
      <div className="page-header-row">
        <div>
          <h1>Notifications</h1>
          <p>Booking, payment, cancellation, and refund updates related to your account.</p>
        </div>
        <div className="hero-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          <button className="btn-primary" onClick={markAll} disabled={loading || unread === 0}>Mark all as read</button>
        </div>
      </div>

      {loading && <div className="page-state">Loading notifications...</div>}
      {error && <div className="error-state-box inline-alert"><p>{error}</p></div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">No notifications yet. You will see booking and payment updates here.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="notifications-list">
          {items.map(n => (
            <div key={n.notification_id} className={`notification-item ${n.is_read ? 'read' : 'unread'}`}>
              <div className="notification-main">
                <div className="notification-top">
                  <strong>{n.title}</strong>
                  <span className="muted-note">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p>{n.message}</p>
                <div className="muted-note">Type: {n.type}{n.related_booking_id ? ` • Booking #${n.related_booking_id}` : ''}</div>
              </div>
              <div className="notification-actions">
                {!n.is_read && <button className="btn-secondary" onClick={() => markOne(n.notification_id)}>Mark as read</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
