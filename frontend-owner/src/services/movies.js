import { apiFetch, toList } from './api'

export const fetchMovies = (token, search = '') =>
  apiFetch(`/movies${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token })

// "Show Movies": the global catalogue minus movies already mapped to the
// caller's theatre. The theatre is resolved server-side from the session.
export const fetchAvailableMovies = (token, { search = '', theatreId } = {}) => {
  const params = new URLSearchParams({ exclude_mapped: 'true' })
  if (search.trim()) params.set('search', search.trim())
  if (theatreId) params.set('theatre_id', String(theatreId))
  return apiFetch(`/movies?${params.toString()}`, { token })
}

export const fetchMovie = (movieId, token) =>
  apiFetch(`/movies/${movieId}`, { token })

export const fetchMovieByName = async (name, token) => {
  const data = await apiFetch(`/movies?search=${encodeURIComponent(name)}`, { token })
  const items = toList(data)
  const needle = name.trim().toLowerCase()
  return items.find((m) => (m.movie_name || '').trim().toLowerCase() === needle) || null
}

export const createMovie = (payload, token) =>
  apiFetch('/movies', { method: 'POST', body: payload, token })

export const updateMovie = (movieId, payload, token) =>
  apiFetch(`/movies/${movieId}`, { method: 'PUT', body: payload, token })

export const deleteMovie = (movieId, token) =>
  apiFetch(`/movies/${movieId}`, { method: 'DELETE', token })
