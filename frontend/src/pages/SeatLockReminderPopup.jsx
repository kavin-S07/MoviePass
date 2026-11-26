import { useEffect } from 'react'
import { formatCountdown, useLockCountdown } from '../components/LockTimer'

// Shown a few minutes before the seat lock expires. The countdown is derived from the
// lock's real expires_at, so it stays correct after refresh/navigation.
export default function SeatLockReminderPopup({ expiresAt, onClose, onComplete, actionLabel = 'Complete Payment →' }) {
  const { expiresAtMs, remainingMs, expired } = useLockCountdown(expiresAt)

  // Auto-close shortly after the lock expires.
  useEffect(() => {
    if (!expired) return undefined
    const id = setTimeout(() => onClose?.(), 800)
    return () => clearTimeout(id)
  }, [expired, onClose])

  // Escape closes the reminder.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!expiresAtMs) return null

  const minutes = Math.max(1, Math.ceil(remainingMs / 60000))
  const title = expired
    ? 'Your seat hold has expired'
    : remainingMs <= 60 * 1000
      ? 'Less than 1 minute left to complete your booking!'
      : `Only ${minutes} minute${minutes === 1 ? '' : 's'} left to complete your booking!`

  return (
    <div
      className="seat-lock-reminder-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="seat-lock-reminder-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="seat-lock-reminder-card">
        <button className="seat-lock-reminder-close" type="button" aria-label="Close reminder" onClick={onClose}>×</button>
        <div className="seat-lock-reminder-icon" aria-hidden="true">⌛</div>
        <h2 id="seat-lock-reminder-title" className="seat-lock-reminder-title">{title}</h2>
        <p className="seat-lock-reminder-text">
          Complete your payment now to confirm your seats before the hold expires.
        </p>
        <div className={`seat-lock-reminder-countdown ${expired ? 'expired' : ''}`} role="timer" aria-label="Time remaining until seat lock expires">
          {formatCountdown(remainingMs)}
        </div>
        <div className="seat-lock-reminder-actions">
          <button className="seat-lock-reminder-dismiss" type="button" onClick={onClose}>Dismiss</button>
          <button className="seat-lock-reminder-action" type="button" onClick={onComplete} disabled={expired}>{actionLabel}</button>
        </div>
      </div>
    </div>
  )
}
