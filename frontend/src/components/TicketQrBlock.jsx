import { useMemo, useState } from 'react'

import { qrToSvg } from '../utils/qr'

// Compact QR card shown after a booking is confirmed (payment result).
// Renders the ticket's qr_code_identifier (a non-guessable entry QR ID).
export default function TicketQrBlock({ ticket }) {

  const [imgError, setImgError] = useState(false)

  const qrId = ticket?.qr_code_identifier || ''
  const qrSvg = useMemo(() => {
    try {
      return qrId ? qrToSvg(qrId, 180) : ''
    } catch {
      return ''
    }
  }, [qrId])
  const qrImgUrl = qrId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(qrId)}`
    : ''

  if (!ticket) return null

  return (
    <div className="ticket-qr-block" aria-label="Booking QR code">
      <h2 className="ticket-qr-title">Your Booking QR Code</h2>
      <p className="muted-note">Show this QR code at entry to confirm your booking.</p>
      {qrSvg ? (
        <div className="qr-svg-wrap" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      ) : qrImgUrl && !imgError ? (
        <div className="qr-svg-wrap">
          <img
            src={qrImgUrl}
            alt="Booking QR code"
            width="180"
            height="180"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      ) : qrId ? (
        <div className="qr-fallback" aria-label="QR code unavailable">{qrId}</div>
      ) : (
        <div className="qr-fallback">QR unavailable</div>
      )}
      <p className="muted-note qr-note">QR ID: {qrId || 'N/A'}</p>
    </div>
  )
}
