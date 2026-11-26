import { apiFetch } from './api'

export const fetchShowSeatLayout = (showId) =>
  apiFetch(`/bookings/shows/${showId}/seats`)

export const lockShowSeats = (showId, seatIds) =>
  apiFetch(`/bookings/shows/${showId}/locks`, {
    method: 'POST',
    body: { seat_ids: seatIds },
  })

export const releaseShowSeatLocks = (showId, payload = {}) =>
  apiFetch(`/bookings/shows/${showId}/locks/release`, {
    method: 'POST',
    body: payload,
  })

export const fetchBookingSummary = (lockToken) =>
  apiFetch(`/bookings/summary?lock_token=${encodeURIComponent(lockToken)}`)

export const createBookingCheckout = (lockToken) =>
  apiFetch('/bookings/checkout', {
    method: 'POST',
    body: { lock_token: lockToken },
  })

export const fetchBookingStatus = (bookingId) =>
  apiFetch(`/bookings/${bookingId}`)

export const verifyBookingPayment = (bookingId, payload) =>
  apiFetch(`/bookings/${bookingId}/payments/verify`, {
    method: 'POST',
    body: payload,
  })

export const createPaymentOrder = (bookingId) =>
  apiFetch('/payments/create-order', {
    method: 'POST',
    body: { booking_id: bookingId },
  })

export const verifyRazorpayPayment = (payload) =>
  apiFetch('/payments/verify', {
    method: 'POST',
    body: payload,
  })

export const retryBookingPayment = (bookingId) =>
  apiFetch(`/bookings/${bookingId}/payments/retry`, {
    method: 'POST',
  })

export const fetchSandboxPaymentHelpers = (bookingId) =>
  apiFetch(`/bookings/${bookingId}/payments/sandbox/helpers`)

export const fetchMyBookings = () =>
  apiFetch('/bookings/my')

export const fetchBookingDetails = (bookingId) =>
  apiFetch(`/bookings/${bookingId}/details`)

export const fetchTicket = (bookingId) =>
  apiFetch(`/bookings/${bookingId}/ticket`)

export const fetchTicketDownloadData = (bookingId) =>
  apiFetch(`/bookings/${bookingId}/ticket/download`)

export const verifyTicket = (payload) =>
  apiFetch('/bookings/tickets/verify', {
    method: 'POST',
    body: payload,
  })

export const cancelBooking = (bookingId) =>
  apiFetch(`/bookings/${bookingId}/cancel`, {
    method: 'POST',
  })
