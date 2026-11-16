import { apiFetch } from './api'

export const fetchMovies = (token, search = '') =>
  apiFetch(`/movies${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token })

export const fetchMovie = (movieId, token) =>
  apiFetch(`/movies/${movieId}`, { token })

export const createMovie = (payload, token) =>
  apiFetch('/movies', { method: 'POST', body: payload, token })

export const updateMovie = (movieId, payload, token) =>
  apiFetch(`/movies/${movieId}`, { method: 'PUT', body: payload, token })

export const deleteMovie = (movieId, token) =>
  apiFetch(`/movies/${movieId}`, { method: 'DELETE', token })
