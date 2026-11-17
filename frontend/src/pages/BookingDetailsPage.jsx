import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
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

function CancelBookingModal({ detail, token, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const seats = Array.isArray(detail.seat_numbers) ? detail.seat_numbers.join(', ') : 'N/A'
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
      await cancelBooking(detail.booking_id, token)
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
          <div className="dt-info-item"><span>Amount</span><strong>{money(detail.total_amount, detail.currency)}</strong></div>
        </div>
        <div className="dt-note" style={{ marginTop: 10 }}>
          <strong>Refund policy:</strong> {policy}
        </div>
        {err && <div className="error-state-box inline-alert" style={{ marginTop: 10 }}><p>{err}</p></div>}
        <div className="modal-actions cancel-booking-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Keep Booking</button>
          <button type="button" className="btn-danger" onClick={confirm} disabled={submitting}>{submitting ? 'Cancelling...' : 'Yes, Cancel Booking'}</button>
        </div>
      </div>
    </div>
  )
}

export default function BookingDetailsPage({ bookingId, onBack }) {
  const { token } = useAuth()
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
      const res = await fetchBookingDetails(bookingId, token)
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
      const res = await fetchTicket(bookingId, token)
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

  const seats = (detail.seat_numbers || []).join(', ')
  const ticket = detail.ticket

  return (
    <div className="page-container booking-details-page">
      <div className="page-header-row no-print">
        <div>
          <button className="btn-link back-link" onClick={onBack}>← Back to My Bookings</button>
          <h1>Booking Details</h1>
          <p>Complete booking and ticket information.</p>
        </div>
      </div>

      {ticketMsg && <div className="inline-alert info-state-box"><p>{ticketMsg}</p></div>}

      <div className="checkout-grid">
        <section className="checkout-card">
          <h2>Movie & Show</h2>
          <div className="summary-row"><span>Movie</span><strong>{detail.movie_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Theatre</span><strong>{detail.theatre_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Address</span><strong>{[detail.theatre_address, detail.theatre_city].filter(Boolean).join(', ') || 'N/A'}</strong></div>
          <div className="summary-row"><span>Screen</span><strong>{detail.screen_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Date</span><strong>{detail.show_date || 'N/A'}</strong></div>
          <div className="summary-row"><span>Time</span><strong>{detail.show_time ? String(detail.show_time).slice(0,5) : ''}{detail.end_time ? ` - ${String(detail.end_time).slice(0,5)}` : ''}</strong></div>
          <div className="summary-row"><span>Seats</span><strong>{seats || 'N/A'}</strong></div>
        </section>

        <section className="checkout-card">
          <h2>Booking & Payment</h2>
          <div className="summary-row"><span>Booking Reference</span><strong>{detail.booking_reference}</strong></div>
          <div className="summary-row"><span>Booking Status</span><strong>{detail.booking_status}</strong></div>
          <div className="summary-row"><span>Payment Status</span><strong>{detail.payment_status || 'N/A'}</strong></div>
          <div className="summary-row"><span>Refund Status</span><strong>{detail.refund_status || 'N/A'}</strong></div>
          <div className="summary-row"><span>Subtotal</span><strong>₹{Number(detail.ticket_subtotal || 0).toFixed(2)}</strong></div>
          <div className="summary-row"><span>Tax</span><strong>₹{Number(detail.tax_amount || 0).toFixed(2)}</strong></div>
          <div className="summary-row"><span>Convenience Fee</span><strong>₹{Number(detail.convenience_fee || 0).toFixed(2)}</strong></div>
          <div className="summary-divider" />
          <div className="summary-row total"><span>Total Amount</span><strong>₹{Number(detail.total_amount || 0).toFixed(2)} {detail.currency || ''}</strong></div>
          <div className="ticket-actions no-print" style={{marginTop:12}}>
            <button className="btn-secondary" onClick={copyRef}>Copy Booking Reference</button>
            {detail.booking_status === 'CONFIRMED' && (
              <button className="btn-primary" onClick={handleViewTicket} disabled={ticketLoading}>{ticketLoading ? 'Loading Ticket...' : (ticket ? 'Refresh Ticket' : 'View Ticket')}</button>
            )}
            {detail.can_cancel ? (
              <button className="btn-danger" onClick={() => setShowCancel(true)}>Cancel Booking</button>
            ) : (detail.cancel_blocked_reason && detail.booking_status === 'CONFIRMED' ? (
              <span className="muted-note" style={{ alignSelf: 'center' }}>{detail.cancel_blocked_reason}</span>
            ) : null)}
          </div>
          {showCancel && detail.can_cancel && (
            <CancelBookingModal
              detail={detail}
              token={token}
              onClose={() => setShowCancel(false)}
              onSuccess={async (msg) => {
                setShowCancel(false)
                setTicketMsg(msg || 'Booking cancelled successfully.')
                await load()
              }}
            />
          )}
        </section>
      </div>

      {detail.booking_status === 'CONFIRMED' ? (
        ticket ? (
          <div style={{marginTop:16}}>
            <TicketView ticket={ticket} onPrint={printTicket} onDownloadPdf={downloadPdf} onCopyRef={copyRef} />
          </div>
        ) : (
          <div className="empty-state" style={{marginTop:16}}>
            <p>Ticket not loaded yet.</p>
            <button className="btn-primary" onClick={handleViewTicket} disabled={ticketLoading}>{ticketLoading ? 'Loading...' : 'Generate / Retrieve Ticket'}</button>
          </div>
        )
      ) : (
        <div className="empty-state" style={{marginTop:16}}>
          {['PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING'].includes(detail.booking_status) ? (
            <p>This booking is pending. It is not confirmed or issued yet.</p>
          ) : (
            <p>Valid tickets are available only for confirmed bookings.</p>
          )}
        </div>
      )}
    </div>
  )
}
