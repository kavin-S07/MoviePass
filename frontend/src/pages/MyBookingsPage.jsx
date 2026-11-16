import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchMyBookings } from '../services/bookings'

function BookingCard({ item, onView }) {
  const seats = (item.seat_numbers || []).join(', ')
  return (
    <div className="booking-card">
      <div className="booking-card-main">
        <h3>{item.movie_name || 'Movie'}</h3>
        <p><strong>Theatre:</strong> {item.theatre_name || 'N/A'} {item.screen_name ? `• ${item.screen_name}` : ''}</p>
        <p><strong>Date & Time:</strong> {item.show_date || 'N/A'} {item.show_time ? String(item.show_time).slice(0,5) : ''}</p>
        <p><strong>Seats:</strong> {seats || 'N/A'}</p>
        <p><strong>Booking Ref:</strong> {item.booking_reference}</p>
        <p><strong>Total:</strong> ₹{Number(item.total_amount || 0).toFixed(2)} {item.currency || ''}</p>
        <p><strong>Status:</strong> {item.booking_status} {item.ticket_status ? `• Ticket: ${item.ticket_status}` : ''} {item.refund_status ? `• Refund: ${item.refund_status}` : ''}</p>
        {item.booking_date && <p className="muted-note">Booked on: {new Date(item.booking_date).toLocaleString()}</p>}
      </div>
      <div className="booking-card-actions">
        <button className="btn-primary" onClick={() => onView(item.booking_id)}>View Details / Ticket</button>
      </div>
    </div>
  )
}

function Section({ title, items, onView, emptyText }) {
  return (
    <section className="bookings-section">
      <h2>{title}</h2>
      {(!items || items.length === 0) ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="bookings-list">
          {items.map((b) => <BookingCard key={b.booking_id} item={b} onView={onView} />)}
        </div>
      )}
    </section>
  )
}

export default function MyBookingsPage({ onViewBooking }) {
  const { token } = useAuth()
  const [data, setData] = useState({ upcoming: [], past: [], cancelled: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetchMyBookings(token)
      setData({ upcoming: res.upcoming || [], past: res.past || [], cancelled: res.cancelled || [] })
    } catch (e) {
      setError(e.message || 'Failed to load bookings')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  return (
    <div className="page-container my-bookings-page">
      <div className="page-header-row">
        <div>
          <h1>My Bookings</h1>
          <p>View upcoming, past, and cancelled bookings and access your digital tickets.</p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      {loading && <div className="page-state">Loading bookings...</div>}
      {error && <div className="error-state-box inline-alert"><p>{error}</p><button className="btn-primary" onClick={load}>Retry</button></div>}
      {!loading && !error && (
        <>
          <Section title="Upcoming Bookings" items={data.upcoming} onView={onViewBooking} emptyText="No upcoming bookings." />
          <Section title="Past Bookings" items={data.past} onView={onViewBooking} emptyText="No past bookings." />
          <Section title="Cancelled Bookings" items={data.cancelled} onView={onViewBooking} emptyText="No cancelled bookings." />
        </>
      )}
    </div>
  )
}
