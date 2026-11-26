import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications'


// ---- display helpers (UI only) ----
function typeMeta(type) {
  const t = String(type || '').toUpperCase()
  const label = t ? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ') : 'Update'
  if (t.includes('REFUND')) return { icon: '💸', tone: 'warning', label }
  if (t.includes('CANCEL') || t.includes('FAIL')) return { icon: t.includes('FAIL') ? '⚠️' : '✖️', tone: 'danger', label }
  if (t.includes('PAYMENT')) return { icon: '💳', tone: 'success', label }
  if (t.includes('BOOKING') || t.includes('TICKET')) return { icon: '🎟️', tone: 'success', label }
  return { icon: '🔔', tone: 'info', label }
}

function sameDay(a, b) { return a.toDateString() === b.toDateString() }

function dayLabel(d) {
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeText(d) {
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (sameDay(d, new Date()) && diffMin < 12 * 60) return `${Math.floor(diffMin / 60)} hr ago`
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export default function NotificationsPage({ onUnreadChange }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetchNotifications()
      setItems(res.notifications || [])
      setUnread(res.unread_count || 0)
      onUnreadChange?.(res.unread_count || 0)
    } catch (e) { setError(e.message || 'Failed to load notifications') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  async function markOne(id) {
    try {
      await markNotificationRead(id)
      await load()
    } catch (e) { setError(e.message || 'Failed to mark notification as read') }
  }

  async function markAll() {
    try {
      const res = await markAllNotificationsRead()
      setUnread(res.unread_count || 0)
      onUnreadChange?.(res.unread_count || 0)
      await load()
    } catch (e) { setError(e.message || 'Failed to mark all as read') }
  }

  const groups = useMemo(() => {
    const visible = filter === 'unread' ? items.filter((n) => !n.is_read) : items
    const map = new Map()
    visible.forEach((n) => {
      const d = new Date(n.created_at)
      const key = d.toDateString()
      if (!map.has(key)) map.set(key, { key, label: dayLabel(d), items: [] })
      map.get(key).items.push(n)
    })
    return [...map.values()]
  }, [items, filter])

  return (
    <div className="page-container notifications-page">
      <div className="notif-header">
        <div>
          <h1>Notifications</h1>
          <p>Booking, payment, cancellation, and refund updates related to your account.</p>
        </div>
        <div className="notif-header-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          <button className="btn-primary" onClick={markAll} disabled={loading || unread === 0}>Mark all as read</button>
        </div>
      </div>

      <div className="notif-tabs" role="tablist" aria-label="Filter notifications">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={`notif-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All <span className="notif-count">{items.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={filter === 'unread'} className={`notif-tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
          Unread <span className="notif-count">{unread}</span>
        </button>
      </div>

      {error && <div className="error-state-box inline-alert"><p>{error}</p></div>}
      {loading && items.length === 0 && <div className="page-state">Loading notifications...</div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state notif-empty"><span className="notif-empty-icon">🔔</span>No notifications yet. You will see booking and payment updates here.</div>
      )}
      {!loading && !error && items.length > 0 && groups.length === 0 && (
        <div className="empty-state notif-empty"><span className="notif-empty-icon">🎉</span>You're all caught up. No unread notifications.</div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="notif-group">
          <h2 className="notif-group-title">{g.label}</h2>
          <div className="notif-list">
            {g.items.map((n) => {
              const meta = typeMeta(n.type)
              const when = new Date(n.created_at)
              return (
                <article key={n.notification_id} className={`notif-card ${n.is_read ? 'read' : 'unread'}`}>
                  <div className={`notif-icon tone-${meta.tone}`} aria-hidden="true">{meta.icon}</div>
                  <div className="notif-body">
                    <div className="notif-top">
                      <strong className="notif-title">
                        {n.title}
                        {!n.is_read && <span className="notif-dot" role="img" aria-label="Unread" />}
                      </strong>
                      <time className="notif-time" dateTime={n.created_at} title={when.toLocaleString()}>{timeText(when)}</time>
                    </div>
                    <p className="notif-message">{n.message}</p>
                    <div className="notif-meta">
                      <span className={`notif-badge tone-${meta.tone}`}>{meta.label}</span>
                      {n.related_booking_id && (
                        <button type="button" className="notif-link" onClick={() => navigate(`/bookings/${n.related_booking_id}`)}>
                          View booking #{n.related_booking_id} →
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="notif-actions">
                    {!n.is_read && <button type="button" className="notif-mark" onClick={() => markOne(n.notification_id)}>Mark as read</button>}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}