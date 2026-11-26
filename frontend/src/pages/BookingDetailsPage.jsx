import { useEffect, useState } from 'react'
import { cancelBooking, fetchBookingDetails, fetchTicket } from '../services/bookings'
import TicketView from '../components/TicketView'

function money(amount, currency = 'INR') {
  const n = Number(amount || 0)
  const sym = currency === 'INR' ? '₹' : (currency ? `${currency} ` : '')
  return `${sym}${n.toFixed(2)}`
}

function fmtDate(d) {
  if (!d) return 'N/A'
  try {
    const dt = new Date(`${d}T00:00:00`)
    if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  } catch {}
  return String(d)
}

function fmtTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

const SUCCESS_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14l3 3 5-6" />
  </svg>
)

function statusColor(status) {
  const s = String(status || '').toUpperCase()
  if (['CONFIRMED', 'USED', 'ISSUED', 'ACTIVE', 'PAID', 'CAPTURED', 'SUCCESS'].includes(s)) return 'success'
  if (['CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED', 'VOID'].includes(s)) return 'danger'
  if (['PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING', 'REFUND_PENDING'].includes(s)) return 'warn'
  return 'neutral'
}

function CancelBookingModal({ detail, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const seats = Array.isArray(detail.seat_numbers) ? detail.seat_numbers.join(', ') : 'N/A'
  const amount = money(detail.total_amount, detail.currency)
  const showWhen = `${fmtDate(detail.show_date)}${detail.show_time ? ` • ${fmtTime(detail.show_time)}` : ''}`
  const policy = detail.cancellation_policy || 'If payment was captured, a refund will be initiated according to payment/refund status.'

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  async function confirm() {
    if (submitting) return
    setSubmitting(true); setErr('')
    try {
      await cancelBooking(detail.booking_id)
      onSuccess('Booking cancelled successfully.')
    } catch (e) {
      setErr(e?.message || 'Failed to cancel booking')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => { if (!submitting) onClose() }}>
      <div className="modal-card cancel-booking-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cancel booking">
        <h3>Cancel this booking?</h3>
        <p className="dt-submeta">Please review the booking details before confirming cancellation.</p>
        <div className="cancel-booking-summary">
          <div className="dt-info-item"><span>Movie</span><strong>{detail.movie_name || 'N/A'}</strong></div>
          <div className="dt-info-item"><span>Date & Time</span><strong>{showWhen}</strong></div>
          <div className="dt-info-item"><span>Theatre</span><strong>{detail.theatre_name || 'N/A'}{detail.screen_name ? ` • ${detail.screen_name}` : ''}</strong></div>
          <div className="dt-info-item"><span>Seats</span><strong>{seats}</strong></div>
          <div className="dt-info-item"><span>Booking Reference</span><strong>{detail.booking_reference || `#${detail.booking_id}`}</strong></div>
          <div className="dt-info-item"><span>Amount</span><strong>{amount}</strong></div>
        </div>
        <div className="dt-note" style={{ marginTop: 10 }}>
          <strong>Refund policy:</strong> {policy}
        </div>
        {err && <div className="error-state-box inline-alert" style={{ marginTop: 10 }}><p>{err}</p></div>}
        <div className="modal-actions cancel-booking-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Keep Booking</button>
          <button type="button" className="btn-danger" onClick={confirm} disabled={submitting}>
            {submitting ? 'Cancelling...' : 'Yes, Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MovieInfoCard({ detail }) {
  const seats = (detail.seats || []).map((s) => [s.seat_name, s.category_name, s.price].filter(Boolean).join(' '))
  return (
    <section className="details-card">
      <div className="details-card-head">
        <h2><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 8l4.5 4.5L21 2.5" /><path d="M12 17.25v4.5" /><path d="M8.5 12.75V16h7v-3.25" /></svg> Movie Information</h2>
        <span className={`dt-status-pill dt-status-${statusColor(detail.booking_status)}`}>{String(detail.booking_status || 'N/A').replace(/_/g, ' ')}</span>
      </div>
      <div className="details-card-body">
        <div className="details-poster-wrap" style={{ width: 120, height: 160 }}>
          {detail.movie_poster ? (
            <img src={detail.movie_poster} alt={`${detail.movie_name} poster`} className="details-poster" />
          ) : (
            <div className="details-poster placeholder-poster">No Poster</div>
          )}
        </div>
        <div className="movie-info-text">
          <h3 className="movie-info-name">{detail.movie_name || 'N/A'}</h3>
          <div className="details-info-list">
            {[
              ['Language', detail.language],
              ['Genre', detail.genre],
              ['Certification', detail.certification],
              ['Duration', detail.duration_minutes ? `${Math.floor(detail.duration_minutes / 60)}h ${detail.duration_minutes % 60}m` : null],
              ['Booking Status', detail.booking_status],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="details-info-item"><span>{k}</span><strong>{v}</strong></div>
            ))}
            {seats.length > 0 && (
              <div className="details-info-item"><span>Seats</span><strong>{seats.join(', ')}</strong></div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ShowDetailsCard({ detail }) {
  return (
    <section className="details-card">
      <div className="details-card-head"><h2>Show Details</h2></div>
      <div className="details-info-list">
        <div className="details-info-item"><span>Theatre</span><strong>{detail.theatre_name || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Address</span><strong>{[detail.theatre_address, detail.theatre_city].filter(Boolean).join(', ') || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Screen</span><strong>{detail.screen_name || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Date</span><strong>{fmtDate(detail.show_date)}</strong></div>
        <div className="details-info-item"><span>Time</span><strong>{fmtTime(detail.show_time)}{detail.end_time ? ` - ${fmtTime(detail.end_time)}` : ''}</strong></div>
        <div className="details-info-item"><span>Selected Seats</span><strong>{(detail.seat_numbers || []).join(', ') || 'N/A'}</strong></div>
      </div>
    </section>
  )
}

function DigitalTicketCard({ detail, ticket, onPrint, onDownloadPdf }) {
  return (
    <section className="details-card details-card-ticket">
      <div className="details-card-head">
        <h2>Digital E-Ticket</h2>
        {ticket && <span className="dt-status-pill dt-status-success">QR Available</span>}
      </div>
      <div className="details-info-list">
        <div className="details-info-item"><span>Movie</span><strong>{detail.movie_name || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Booking Reference</span><strong>{detail.booking_reference || `#${detail.booking_id}`}</strong></div>
        {ticket?.ticket_reference && (
          <div className="details-info-item"><span>Ticket Reference</span><strong>{ticket.ticket_reference}</strong></div>
        )}
        <div className="details-info-item"><span>Theatre</span><strong>{detail.theatre_name || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Screen</span><strong>{detail.screen_name || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Date & Time</span><strong>{fmtDate(detail.show_date)}{fmtTime(detail.show_time) ? ` • ${fmtTime(detail.show_time)}` : ''}</strong></div>
        <div className="details-info-item"><span>Seats</span><strong>{(detail.seat_numbers || []).join(', ') || 'N/A'}</strong></div>
        <div className="details-info-item"><span>Total Amount</span><strong>{money(detail.total_amount, detail.currency)}</strong></div>
      </div>
      <div className="details-qr-wrap">
        {ticket ? (
          <TicketView ticket={ticket} onPrint={onPrint} onDownloadPdf={onDownloadPdf} />
        ) : (
          <div className="details-qr-empty"><p>Digital ticket is being generated. It will be available shortly.</p></div>
        )}
      </div>
    </section>
  )
}

function PaymentSummaryCard({ detail }) {
  const rows = [
    ['Ticket Subtotal', money(detail.ticket_subtotal, detail.currency)],
    ['Taxes', money(detail.tax_amount, detail.currency)],
    ['Convenience Fee', money(detail.convenience_fee, detail.currency)],
    ['Total Amount Paid', money(detail.total_amount, detail.currency)],
  ].filter(([, v]) => v)
  const paymentStatus = detail.payment_status || 'N/A'
  const refundStatus = detail.refund_status ? String(detail.refund_status).replace(/_/g, ' ') : null
  return (
    <section className="details-card">
      <div className="details-card-head"><h2>Payment Summary</h2></div>
      <div className="details-info-list">
        {rows.map(([k, v]) => (
          <div key={k} className={`details-info-item${k.includes('Total') ? ' details-info-item-total' : ''}`}>
            <span>{k}</span><strong>{v}</strong>
          </div>
        ))}
        <div className="details-info-item"><span>Payment Status</span><strong className={`details-status details-status-${statusColor(paymentStatus)}`}>{paymentStatus}</strong></div>
        {refundStatus && (
          <div className="details-info-item"><span>Refund Status</span><strong className={`details-status details-status-${statusColor(refundStatus)}`}>{refundStatus}</strong></div>
        )}
      </div>
    </section>
  )
}

export default function BookingDetailsPage({ bookingId, onBack }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  async function load() {
    if (!bookingId) return
    setLoading(true); setError(''); setTicketMsg('')
    try {
      const res = await fetchBookingDetails(bookingId)
      setDetail(res)
    } catch (e) {
      setError(e.message || 'Failed to load booking details')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [bookingId]) // eslint-disable-line

  async function handleViewTicket() {
    if (!bookingId) return
    setTicketLoading(true); setTicketMsg('')
    try {
      const res = await fetchTicket(bookingId)
      setDetail((d) => ({ ...(d && typeof d === 'object' ? d : {}), ticket: res.ticket }))
    } catch (e) {
      setTicketMsg(e.message || 'Unable to load ticket')
    } finally { setTicketLoading(false) }
  }

  async function copyRef() {
    const ref = detail?.booking_reference
    if (!ref) return
    try { await navigator.clipboard.writeText(ref); setTicketMsg('Booking reference copied.') } catch { setTicketMsg('Could not copy booking reference.') }
  }

  function printTicket() {
    window.print()
  }

  function downloadPdf() {
    // Browser print-to-PDF flow (no external PDF dependency). User can choose "Save as PDF".
    setTicketMsg('Use the print dialog and select "Save as PDF" to download your ticket as PDF.')
    setTimeout(() => window.print(), 50)
  }

  if (loading) return <div className="page-state">Loading booking details...</div>
  if (error) return <div className="page-state error-state-box"><p>{error}</p><div className="hero-actions"><button className="btn-secondary" onClick={onBack}>Back</button><button className="btn-primary" onClick={load}>Retry</button></div></div>
  if (!detail) return <div className="page-state">No booking details available.</div>

  const ticket = detail.ticket

  return (
    <div className="booking-details-page">
      <div className="page-header-row">
        <div>
          <button className="btn-link back-link" onClick={onBack}>← Back to My Bookings</button>
        </div>
      </div>

      {ticketMsg && <div className="inline-alert info-state-box"><p>{ticketMsg}</p></div>}

      {/* Booking Confirmation Header */}
      <section className="details-confirmation">
        <div className="details-confirmation-icon">{SUCCESS_ICON}</div>
        <div className="details-confirmation-body">
          <h1 className="details-confirmation-title">Booking Confirmed!</h1>
          <p className="details-confirmation-msg">Your tickets have been reserved. Show the QR code at the theatre entrance.</p>
          <div className="details-confirmation-badges">
            <span className={`status-pill details-confirmation-pill details-confirmation-pill-${statusColor(detail.booking_status)}`}>{String(detail.booking_status || 'N/A').replace(/_/g, ' ')}</span>
            {detail.payment_status && (
              <span className={`status-pill details-confirmation-pill details-confirmation-pill-${statusColor(detail.payment_status)}`}>Payment: {String(detail.payment_status).replace(/_/g, ' ')}</span>
            )}
          </div>
        </div>
      </section>

      {/* Main info grid */}
      <div className="details-grid">
        <MovieInfoCard detail={detail} />
        <ShowDetailsCard detail={detail} />
        <DigitalTicketCard detail={detail} ticket={ticket} onPrint={printTicket} onDownloadPdf={downloadPdf} />
        <PaymentSummaryCard detail={detail} />
      </div>

      {/* Action buttons */}
      <div className="details-actions no-print">
        <button type="button" className="btn-secondary" onClick={copyRef}>Copy Booking Reference</button>
        <button type="button" className="btn-primary" onClick={printTicket}>Print Ticket</button>
        <button type="button" className="btn-secondary" onClick={downloadPdf}>Download Ticket as PDF</button>
        {(!ticket || ticket.qr_code_identifier === undefined || !ticket.qr_code_identifier) && (
          <button type="button" className="btn-secondary" onClick={handleViewTicket} disabled={ticketLoading}>{ticketLoading ? 'Loading Ticket...' : 'Generate Ticket'}</button>
        )}
        {ticket && (
          <button type="button" className="btn-secondary" onClick={handleViewTicket} disabled={ticketLoading}>{ticketLoading ? 'Refreshing...' : 'Refresh Ticket'}</button>
        )}
        {detail.can_cancel && (
          <button type="button" className="btn-danger" onClick={() => setShowCancel(true)}>Cancel Booking</button>
        )}
      </div>

      {showCancel && detail.can_cancel && (
        <CancelBookingModal
          detail={detail}
          onClose={() => setShowCancel(false)}
          onSuccess={async (msg) => {
            setShowCancel(false)
            setTicketMsg(msg || 'Booking cancelled successfully.')
            await load()
          }}
        />
      )}
    </div>
  )
}
