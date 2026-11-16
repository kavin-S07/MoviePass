import { apiFetch } from './api'

export const fetchShowSeatLayout = (showId, token) =>
  apiFetch(`/bookings/shows/${showId}/seats`, { token })

export const lockShowSeats = (showId, seatIds, token) =>
  apiFetch(`/bookings/shows/${showId}/locks`, {
    method: 'POST',
    body: { seat_ids: seatIds },
    token,
  })

export const releaseShowSeatLocks = (showId, payload = {}, token) =>
  apiFetch(`/bookings/shows/${showId}/locks/release`, {
    method: 'POST',
    body: payload,
    token,
  })

export const fetchBookingSummary = (lockToken, token) =>
  apiFetch(`/bookings/summary?lock_token=${encodeURIComponent(lockToken)}`, { token })

export const createBookingCheckout = (lockToken, token) =>
  apiFetch('/bookings/checkout', {
    method: 'POST',
    body: { lock_token: lockToken },
    token,
  })

export const fetchBookingStatus = (bookingId, token) =>
  apiFetch(`/bookings/${bookingId}`, { token })

export const verifyBookingPayment = (bookingId, payload, token) =>
  apiFetch(`/bookings/${bookingId}/payments/verify`, {
    method: 'POST',
    body: payload,
    token,
  })

export const retryBookingPayment = (bookingId, token) =>
  apiFetch(`/bookings/${bookingId}/payments/retry`, {
    method: 'POST',
    token,
  })

export const fetchSandboxPaymentHelpers = (bookingId, token) =>
  apiFetch(`/bookings/${bookingId}/payments/sandbox/helpers`, { token })

export const fetchMyBookings = (token) =>
  apiFetch('/bookings/my', { token })

export const fetchBookingDetails = (bookingId, token) =>
  apiFetch(`/bookings/${bookingId}/details`, { token })

export const fetchTicket = (bookingId, token) =>
  apiFetch(`/bookings/${bookingId}/ticket`, { token })

export const fetchTicketDownloadData = (bookingId, token) =>
  apiFetch(`/bookings/${bookingId}/ticket/download`, { token })

export const verifyTicket = (payload, token) =>
  apiFetch('/bookings/tickets/verify', {
    method: 'POST',
    body: payload,
    token,
  })
