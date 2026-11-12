import { apiFetch } from './api'

export const fetchDashboardStats = (token) =>
  apiFetch('/dashboard/stats', { token })

export const fetchTheatres = (token) =>
  apiFetch('/theatres', { token })

export const fetchTheatre = (theatreId, token) =>
  apiFetch(`/theatres/${theatreId}`, { token })

export const createTheatre = (payload, token) =>
  apiFetch('/theatres', { method: 'POST', body: payload, token })

export const updateTheatre = (theatreId, payload, token) =>
  apiFetch(`/theatres/${theatreId}`, { method: 'PUT', body: payload, token })

export const deleteTheatre = (theatreId, token) =>
  apiFetch(`/theatres/${theatreId}`, { method: 'DELETE', token })
