import { useEffect, useState } from 'react'
import { cancelBooking, fetchMyBookings } from '../services/bookings'

function fmtTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

function fmtDate(d) {
  if (!d) return 'N/A'
  try {
    const dt = new Date(`${d}T00:00:00`)
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    }
  } catch {}
  return String(d)
}

function fmtDateTime(d) {
  if (!d) return 'N/A'
  try {
    const dt = new Date(d)
    if (!Number.isNaN(dt.getTime())) return dt.toLocaleString()
  } catch {}
  return String(d)
}

function money(amount, currency = 'INR') {
  const n = Number(amount || 0)
  const sym = currency === 'INR' ? '₹' : (currency ? `${currency} ` : '')
  return `${sym}${n.toFixed(2)}`
}

function statusLabel(item, variant) {
  if (variant === 'cancelled' || item?.booking_status === 'CANCELLED') return item?.booking_status || 'CANCELLED'
  if (item?.booking_status === 'PENDING' || item?.booking_status === 'PENDING_PAYMENT' || item?.booking_status === 'PAYMENT_PENDING') return item.booking_status === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'PENDING'
  if (item?.booking_status === 'FAILED' || item?.booking_status === 'EXPIRED') return item.booking_status
  if (variant === 'past') return item?.ticket_status || item?.booking_status || 'PAST'
  return item?.ticket_status || item?.booking_status || 'UPCOMING'
}

function statusTone(item, variant) {
  const s = String(statusLabel(item, variant) || '').toUpperCase()
  if (['CANCELLED', 'FAILED', 'EXPIRED'].includes(s)) return 'danger'
  if (['PENDING', 'REFUND_PENDING', 'PENDING_OR_NOT_APPLICABLE'].includes(s)) return 'warn'
  if (['USED', 'ISSUED', 'CONFIRMED', 'ACTIVE'].includes(s)) return 'success'
  return 'neutral'
}

function CancelBookingModal({ item, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const seats = Array.isArray(item.seat_numbers) ? item.seat_numbers.join(', ') : 'N/A'
  const amount = money(item.total_amount, item.currency)
  const showWhen = `${fmtDate(item.show_date)}${item.show_time ? ` • ${fmtTime(item.show_time)}` : ''}`
  const policy = item.cancellation_policy || 'If payment was captured, a refund will be initiated according to payment/refund status.'

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  async function confirmCancel() {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await cancelBooking(item.booking_id)
      onSuccess('Booking cancelled successfully.')
    } catch (e) {
      setError(e?.message || 'Failed to cancel booking')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => { if (!submitting) onClose() }}>
      <div className="modal-card cancel-booking-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cancel booking">
        <h3>Cancel this booking?</h3>
        <p className="dt-submeta">Please review the booking details before confirming cancellation.</p>
        <div className="cancel-booking-summary">
          <div className="dt-info-item"><span>Movie</span><strong>{item.movie_name || 'N/A'}</strong></div>
          <div className="dt-info-item"><span>Date & Time</span><strong>{showWhen}</strong></div>
          <div className="dt-info-item"><span>Theatre</span><strong>{item.theatre_name || 'N/A'}{item.screen_name ? ` • ${item.screen_name}` : ''}</strong></div>
          <div className="dt-info-item"><span>Seats</span><strong>{seats}</strong></div>
          <div className="dt-info-item"><span>Booking Reference</span><strong>{item.booking_reference || `#${item.booking_id}`}</strong></div>
          <div className="dt-info-item"><span>Amount</span><strong>{amount}</strong></div>
        </div>
        <div className="dt-note" style={{ marginTop: 10 }}>
          <strong>Refund policy:</strong> {policy}
        </div>
        {error && <div className="error-state-box inline-alert" style={{ marginTop: 10 }}><p>{error}</p></div>}
        <div className="modal-actions cancel-booking-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Keep Booking</button>
          <button type="button" className="btn-danger" onClick={confirmCancel} disabled={submitting}>
            {submitting ? 'Cancelling...' : 'Yes, Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DigitalTicketCard({ item, variant, onView, onCancelSuccess }) {
  const [shareMsg, setShareMsg] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const bookingRef = item.booking_reference || `#${item.booking_id}`
  const title = item.movie_name || 'Movie'
  const theatre = item.theatre_name || 'N/A'
  const screen = item.screen_name || null
  const dateText = fmtDate(item.show_date)
  const timeText = fmtTime(item.show_time)
  const bookedOn = item.booking_date || item.created_at
  const tone = statusTone(item, variant)
  const label = statusLabel(item, variant)
  const isCancelled = variant === 'cancelled' || item.booking_status === 'CANCELLED'
  const isPending = item.booking_status === 'PENDING' || item.booking_status === 'PENDING_PAYMENT' || item.booking_status === 'PAYMENT_PENDING'
  const detailsPath = `/bookings/${item.booking_id}`
  const canCancel = typeof item.can_cancel === 'boolean'
    ? item.can_cancel
    : (item.booking_status === 'CONFIRMED' && variant === 'upcoming')
  const cancelBlockedReason = !canCancel ? (item.cancel_blocked_reason || null) : null
  const showCancelButton = canCancel && !isCancelled && !['FAILED', 'EXPIRED'].includes(item.booking_status) && variant !== 'past'
  const showCancelReason = !showCancelButton && !!cancelBlockedReason && !isCancelled && variant === 'upcoming' && item.booking_status === 'CONFIRMED'

  async function handleShare() {
    setShareMsg('')
    const url = `${window.location.origin}${detailsPath}`
    const text = `${title} • ${theatre}${screen ? ` (${screen})` : ''} • ${dateText}${timeText ? ` ${timeText}` : ''} • Ref: ${bookingRef}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `MoviePass Ticket - ${title}`, text, url })
        setShareMsg('Shared successfully.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareMsg('Ticket link copied.')
      } else {
        window.prompt('Copy ticket link:', url)
        setShareMsg('Copy the ticket link to share.')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setShareMsg('Unable to share right now.')
    }
  }

  return (
    <article className={`digital-ticket dt-${variant} dt-tone-${tone}`}>
      <div className="dt-top">
        <div className="dt-poster">
          {item.movie_poster ? (
            <img src={item.movie_poster} alt={`${title} poster`} loading="lazy" />
          ) : (
            <div className="dt-poster-placeholder">No Poster</div>
          )}
        </div>
        <div className="dt-main-info">
          <div className="dt-title-row">
            <div>
              <h3 className="dt-title">{title}</h3>
              <p className="dt-submeta">{[item.language, item.format].filter(Boolean).join(' • ') || 'Movie ticket'}</p>
            </div>
            <span className={`dt-status-pill dt-status-${tone}`}>{String(label).replace(/_/g, ' ')}</span>
          </div>
          <div className="dt-info-grid">
            <div className="dt-info-item"><span>Date & Time</span><strong>{dateText}{timeText ? ` • ${timeText}` : ''}</strong></div>
            <div className="dt-info-item"><span>Theatre</span><strong>{theatre}</strong></div>
            {screen ? <div className="dt-info-item"><span>Screen</span><strong>{screen}</strong></div> : null}
            {bookedOn ? <div className="dt-info-item"><span>Booked On</span><strong>{fmtDateTime(bookedOn)}</strong></div> : null}
          </div>
          <div className="dt-top-actions no-print">
            {!isCancelled && <button type="button" className="btn-secondary dt-btn" onClick={handleShare}>Share Ticket</button>}
            <button type="button" className="btn-primary dt-btn" onClick={() => onView(item.booking_id)}>View Details</button>
            {showCancelButton && (
              <button type="button" className="btn-secondary dt-btn dt-btn-danger" onClick={() => setShowCancel(true)}>Cancel Booking</button>
            )}
          </div>
          {showCancelReason && <p className="dt-inline-msg dt-inline-msg-muted">{cancelBlockedReason}</p>}
          {shareMsg && !isCancelled ? <p className="dt-inline-msg">{shareMsg}</p> : null}
        </div>
      </div>

      <div className="dt-separator" aria-hidden="true">
        <span className="dt-notch left" />
        <span className="dt-dash" />
        <span className="dt-notch right" />
      </div>

      <div className="dt-middle">
        {isPending && (
          <div className="dt-note dt-note-warn">This booking is pending. It is not confirmed or issued yet.</div>
        )}
        {isCancelled && (
          <div className="dt-note dt-note-danger">
            <strong>Cancellation:</strong> {item.booking_status || 'Cancelled'}
            {item.refund_status ? <span> • <strong>Refund:</strong> {String(item.refund_status).replace(/_/g, ' ')}</span> : null}
          </div>
        )}
        {!isCancelled && item.refund_status && (
          <div className="dt-note"><strong>Refund:</strong> {String(item.refund_status).replace(/_/g, ' ')}</div>
        )}
      </div>

      <div className="dt-bottom">
        <div className="dt-amount-block">
          <span>{isCancelled ? 'Amount' : 'Total Amount Paid'}</span>
          <strong>{money(item.total_amount, item.currency)}</strong>
        </div>
        <div className="dt-bottom-meta">
          {item.ticket_status ? <span>Ticket: {item.ticket_status}</span> : null}
          {variant === 'past' ? <span className="dt-muted-tag">Past booking</span> : null}
          {variant === 'upcoming' ? <span className="dt-muted-tag">Upcoming</span> : null}
        </div>
      </div>
      {showCancel && (
        <CancelBookingModal
          item={item}
          onClose={() => setShowCancel(false)}
          onSuccess={(msg) => {
            setShowCancel(false)
            onCancelSuccess?.(msg)
          }}
        />
      )}
    </article>
  )
}

function Section({ title, items, onView, emptyText, variant, onCancelSuccess }) {
  return (
    <section className="bookings-section digital-bookings-section">
      <div className="bookings-section-head">
        <h2>{title}</h2>
        <span className="bookings-count">{items?.length || 0}</span>
      </div>
      {(!items || items.length === 0) ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="digital-tickets-grid">
          {items.map((b) => (
            <DigitalTicketCard key={b.booking_id} item={b} variant={variant} onView={onView} onCancelSuccess={onCancelSuccess} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function MyBookingsPage({ onViewBooking }) {
  const [data, setData] = useState({ upcoming: [], past: [], cancelled: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetchMyBookings()
      setData({ upcoming: res.upcoming || [], past: res.past || [], cancelled: res.cancelled || [] })
    } catch (e) {
      setError(e.message || 'Failed to load bookings')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  async function handleCancelSuccess(msg) {
    setSuccessMsg(msg || 'Booking cancelled successfully.')
    await load()
  }

  return (
    <div className="page-container my-bookings-page digital-bookings-page">
      <div className="page-header-row">
        <div>
          <h1>My Bookings</h1>
          <p>View upcoming, past, and cancelled bookings as digital movie tickets.</p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      {successMsg && <div className="info-state-box inline-alert"><p>{successMsg}</p></div>}
      {loading && <div className="page-state">Loading bookings...</div>}
      {error && <div className="error-state-box inline-alert"><p>{error}</p><button className="btn-primary" onClick={load}>Retry</button></div>}
      {!loading && !error && (
        <>
          <Section title="Upcoming Bookings" variant="upcoming" items={data.upcoming} onView={onViewBooking} emptyText="No upcoming bookings." onCancelSuccess={handleCancelSuccess} />
          <Section title="Past Bookings" variant="past" items={data.past} onView={onViewBooking} emptyText="No past bookings." onCancelSuccess={handleCancelSuccess} />
          <Section title="Cancelled Bookings" variant="cancelled" items={data.cancelled} onView={onViewBooking} emptyText="No cancelled bookings." onCancelSuccess={handleCancelSuccess} />
        </>
      )}
    </div>
  )
}
