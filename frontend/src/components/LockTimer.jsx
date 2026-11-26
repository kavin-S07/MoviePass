import { useCallback, useEffect, useState } from 'react'

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Ticks once a second and derives the remaining time from the server's expires_at.
export function useLockCountdown(expiresAt) {
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!expiresAtMs) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAtMs])

  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0
  return { expiresAtMs, remainingMs, expired: Boolean(expiresAtMs && remainingMs <= 0) }
}

// Always-visible "seats held for MM:SS" pill.
export default function LockTimer({ expiresAt, className = '' }) {
  const { expiresAtMs, remainingMs, expired } = useLockCountdown(expiresAt)
  if (!expiresAtMs) return null
  const urgent = !expired && remainingMs <= 60 * 1000
  const warn = !expired && remainingMs <= 4 * 60 * 1000
  return (
    <div
      className={`lock-timer ${urgent ? 'urgent' : warn ? 'warn' : ''} ${expired ? 'expired' : ''} ${className}`}
      role="timer"
      aria-live="off"
    >
      <span className="lock-timer-icon" aria-hidden="true">⏱</span>
      <span className="lock-timer-text">
        <small>{expired ? 'Seat hold' : 'Seats held for'}</small>
        <strong>{expired ? 'Expired' : formatCountdown(remainingMs)}</strong>
      </span>
    </div>
  )
}

// Opens once when the lock is `minutes` away from expiry (or immediately if already inside that window).
export function useLockReminder(expiresAt, { minutes = 4, enabled = true } = {}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
    if (!enabled || !expiresAt) return undefined
    const expiresAtMs = new Date(expiresAt).getTime()
    if (!expiresAtMs || Date.now() >= expiresAtMs) return undefined
    const fireAt = expiresAtMs - minutes * 60 * 1000
    if (Date.now() >= fireAt) {
      setOpen(true)
      return undefined
    }
    const id = setTimeout(() => setOpen(true), fireAt - Date.now())
    return () => clearTimeout(id)
  }, [expiresAt, minutes, enabled])

  const close = useCallback(() => setOpen(false), [])
  return [open, close]
}
