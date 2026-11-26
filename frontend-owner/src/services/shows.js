import { apiFetch } from './api'

export const fetchShows = (token) =>
  apiFetch('/shows', { token })

export const createShow = (payload, token) =>
  apiFetch('/shows', { method: 'POST', body: payload, token })

export const fetchShowBookingSummary = (showId, token) =>
  apiFetch(`/shows/${showId}/booking-summary`, { token })

export const fetchShowSeats = (showId, token) =>
  apiFetch(`/bookings/shows/${showId}/seats`, { token })
