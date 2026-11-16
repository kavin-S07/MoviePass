import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchBookingDetails, fetchTicket } from '../services/bookings'
import TicketView from '../components/TicketView'

export default function BookingDetailsPage({ bookingId, onBack }) {
  const { token } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')

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
          </div>
        </section>
      </div>

      {ticket ? (
        <div style={{marginTop:16}}>
          <TicketView ticket={ticket} onPrint={printTicket} onDownloadPdf={downloadPdf} onCopyRef={copyRef} />
        </div>
      ) : (
        detail.booking_status === 'CONFIRMED' ? (
          <div className="empty-state" style={{marginTop:16}}>
            <p>Ticket not loaded yet.</p>
            <button className="btn-primary" onClick={handleViewTicket} disabled={ticketLoading}>{ticketLoading ? 'Loading...' : 'Generate / Retrieve Ticket'}</button>
          </div>
        ) : (
          <div className="empty-state" style={{marginTop:16}}>
            <p>Valid tickets are available only for confirmed bookings.</p>
          </div>
        )
      )}
    </div>
  )
}
