import { apiFetch } from './api'

export const fetchDashboardStats = (token) =>
  apiFetch('/dashboard/stats', { token })

export const fetchMyTheatreMovies = (token, { search = '', theatreId } = {}) => {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (theatreId) params.set('theatre_id', String(theatreId))
  const qs = params.toString()
  return apiFetch(`/theatres/movies${qs ? `?${qs}` : ''}`, { token })
}

export const mapMovieToTheatre = (movieId, token) =>
  apiFetch('/theatres/movies', { method: 'POST', body: { movie_id: movieId }, token })

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
