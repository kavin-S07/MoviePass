import { useEffect, useState } from 'react'

import { fetchTicket } from '../services/bookings'
import TicketQrBlock from '../components/TicketQrBlock'

function money(n, currency = 'INR') { return `${currency === 'INR' ? '₹' : ''}${Number(n || 0).toFixed(2)}` }

export default function PaymentResultPage({
  status, // 'success' | 'failed'
  bookingStatus,
  paymentResult,
  onRetry,
  onGoHome,
  onViewBookings,
  onViewTicket,
  retrying,
}) {
  const isSuccess = status === 'success'
  const bookingId = bookingStatus?.booking_id || paymentResult?.bookingId
  const bookingRef = bookingStatus?.booking_reference || paymentResult?.result?.booking_reference
  const payment = bookingStatus?.payment
  const currency = bookingStatus?.currency || payment?.currency || 'INR'
  const [ticket, setTicket] = useState(null)

  // After a successful booking, fetch the ticket (and its QR) to show here.
  useEffect(() => {
    if (!isSuccess || !bookingId) {
      setTicket(null)
      return undefined
    }
    let cancelled = false
    fetchTicket(bookingId)
      .then((res) => { if (!cancelled) setTicket(res?.ticket || null) })
      .catch(() => { if (!cancelled) setTicket(null) })
    return () => { cancelled = true }
  }, [isSuccess, bookingId])

  return (
    <div className="payment-result-page">
      <div className={`result-card ${isSuccess ? 'success' : 'failed'}`}>
        <h1>{isSuccess ? 'Payment Verified & Booking Confirmed' : 'Payment Failed or Not Verified'}</h1>
        <p>
          {isSuccess
            ? 'Your payment evidence was verified on the server and the booking has been confirmed. Ticket issuance records are created for the confirmed booking.'
            : (paymentResult?.message || paymentResult?.result?.message || 'The payment could not be verified/confirmed. You may retry if the booking and lock are still valid.')}
        </p>

        <div className="result-details">
          <div className="summary-row"><span>Booking ID</span><strong>{bookingId || 'N/A'}</strong></div>
          <div className="summary-row"><span>Booking Reference</span><strong>{bookingRef || 'N/A'}</strong></div>
          <div className="summary-row"><span>Booking Status</span><strong>{bookingStatus?.booking_status || paymentResult?.result?.booking_status || 'N/A'}</strong></div>
          <div className="summary-row"><span>Payment Status</span><strong>{bookingStatus?.payment?.payment_status || paymentResult?.result?.payment_status || 'N/A'}</strong></div>
          <div className="summary-row"><span>Provider</span><strong>{payment?.provider || paymentResult?.result?.provider || 'N/A'}{payment?.is_sandbox || paymentResult?.result?.is_sandbox ? ' (Sandbox/Test)' : ''}</strong></div>
          <div className="summary-row"><span>Amount</span><strong>{money(bookingStatus?.total_payable_amount ?? payment?.amount ?? paymentResult?.result?.amount, currency)}</strong></div>
          {bookingStatus?.seats?.length ? (
            <div className="summary-row"><span>Seats</span><strong>{bookingStatus.seats.map(s => s.seat_name).join(', ')}</strong></div>
          ) : null}
        </div>

        <div className="hero-actions result-actions">
          {isSuccess && bookingId && (
            <button className="btn-primary" onClick={() => onViewTicket?.(bookingId)}>View Ticket / Booking Details</button>
          )}
          {!isSuccess && bookingId && (
            <button className="btn-primary" onClick={() => onRetry?.(bookingId)} disabled={retrying}>
              {retrying ? 'Retrying payment...' : 'Retry Payment'}
            </button>
          )}
          <button className="btn-secondary" onClick={onViewBookings}>My Bookings</button>
          <button className="btn-secondary" onClick={onGoHome}>Go to Home</button>
        </div>

        {isSuccess && ticket && <div style={{ marginTop: 16 }}><TicketQrBlock ticket={ticket} /></div>}

        {isSuccess && ticket && <div style={{ marginTop: 16 }}><TicketQrBlock ticket={ticket} /></div>}

        {isSuccess && (payment?.is_sandbox || paymentResult?.result?.is_sandbox) && <p className="muted-note">Note: In sandbox/test mode, this confirmation is based on isolated sandbox signature verification and is not a real money transaction.</p>}
        {isSuccess && !(payment?.is_sandbox || paymentResult?.result?.is_sandbox) && <p className="muted-note">Payment was verified on the server. Booking is confirmed only after captured payment verification.</p>}
      </div>
    </div>
  )
}
