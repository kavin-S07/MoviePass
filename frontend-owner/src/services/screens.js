import { apiFetch } from './api'

export const createScreen = (theatreId, payload, token) =>
  apiFetch(`/theatres/${theatreId}/screens`, {
    method: 'POST',
    body: payload,
    token
  })

export const fetchScreens = (theatreId, token) =>
  apiFetch(`/theatres/${theatreId}/screens`, { token })

export const fetchScreen = (screenId, token) =>
  apiFetch(`/screens/${screenId}`, { token })

export const deleteScreen = (screenId, token) =>
  apiFetch(`/screens/${screenId}`, {
    method: 'DELETE',
    token
  })
