import { apiFetch } from './api'

function buildQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const fetchAdminOverview = (token) =>
  apiFetch('/admin/overview', { token })

export const fetchAdminUsers = (params, token) =>
  apiFetch(`/admin/users${buildQuery(params)}`, { token })

export const fetchAdminTheatres = (params, token) =>
  apiFetch(`/admin/theatres${buildQuery(params)}`, { token })

export const fetchAdminMovies = (params, token) =>
  apiFetch(`/admin/movies${buildQuery(params)}`, { token })

export const fetchAdminShows = (params, token) =>
  apiFetch(`/admin/shows${buildQuery(params)}`, { token })
