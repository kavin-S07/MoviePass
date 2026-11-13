import { apiFetch } from './api'

export const fetchShows = (token) =>
  apiFetch('/shows', { token })

export const createShow = (payload, token) =>
  apiFetch('/shows', { method: 'POST', body: payload, token })
