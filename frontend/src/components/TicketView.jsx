import { useMemo, useState } from 'react'
import { qrToSvg } from '../utils/qr'

export default function TicketView({ ticket, onPrint, onDownloadPdf, onCopyRef }) {
  const [imgError, setImgError] = useState(false)
  const qrSvg = useMemo(() => {
    try {
      return ticket?.qr_code_identifier ? qrToSvg(ticket.qr_code_identifier, 180) : ''
    } catch {
      return ''
    }
  }, [ticket?.qr_code_identifier])

  if (!ticket) return null
  const seats = (ticket.seat_numbers || []).join(', ')
  const qrId = ticket.qr_code_identifier || ''
  const qrImgUrl = qrId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(qrId)}`
    : ''

  return (
    <div className="ticket-view-card printable-ticket" id="printable-ticket">
      <div className="ticket-header">
        <div>
          <h2>{ticket.movie_name || 'Movie Ticket'}</h2>
          <p className="muted-note">Booking Ref: <strong>{ticket.booking_reference}</strong></p>
          <p className="muted-note">Ticket Ref: <strong>{ticket.ticket_reference}</strong></p>
        </div>
        <div className={`status-pill status-${String(ticket.ticket_status || '').toLowerCase()}`}>{ticket.ticket_status}</div>
      </div>
      <div className="ticket-body-grid">
        <div className="ticket-details">
          <div className="summary-row"><span>Theatre</span><strong>{ticket.theatre_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Address</span><strong>{ticket.theatre_address || 'N/A'}</strong></div>
          <div className="summary-row"><span>Screen</span><strong>{ticket.screen_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Date</span><strong>{ticket.show_date || 'N/A'}</strong></div>
          <div className="summary-row"><span>Time</span><strong>{ticket.show_time ? String(ticket.show_time).slice(0,5) : 'N/A'}</strong></div>
          <div className="summary-row"><span>Seats</span><strong>{seats || 'N/A'}</strong></div>
          <div className="summary-row"><span>Total Amount</span><strong>{ticket.currency === 'INR' ? '₹' : ''}{Number(ticket.total_amount || 0).toFixed(2)} {ticket.currency || ''}</strong></div>
          <div className="summary-row"><span>Booking Status</span><strong>{ticket.booking_confirmation_status || 'N/A'}</strong></div>
        </div>
        <div className="ticket-qr-block">
          {qrSvg ? (
            <div className="qr-svg-wrap" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : qrImgUrl && !imgError ? (
            <div className="qr-svg-wrap">
              <img
                src={qrImgUrl}
                alt="Ticket QR code"
                width="180"
                height="180"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            </div>
          ) : qrId ? (
            <div className="qr-fallback" aria-label="QR code unavailable">QR unavailable (show this QR ID at entry)</div>
          ) : (
            <div className="qr-fallback">QR unavailable</div>
          )}
          <p className="muted-note qr-note">QR ID: {qrId || 'N/A'}</p>
          <p className="muted-note">Unique, non-guessable QR identifier (no sensitive user/payment data).</p>
        </div>
      </div>
      <div className="ticket-actions no-print">
        <button className="btn-secondary" onClick={onCopyRef}>Copy Booking Reference</button>
        <button className="btn-secondary" onClick={onPrint}>Print Ticket</button>
        <button className="btn-primary" onClick={onDownloadPdf}>Download Ticket as PDF</button>
      </div>
    </div>
  )
}
