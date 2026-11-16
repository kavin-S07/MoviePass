import { apiFetch } from './api'

function qs(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, value)
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const fetchBookerHome = (params = {}, token) =>
  apiFetch(`/booker/home${qs(params)}`, { token })

export const fetchBookerMovies = (params = {}, token) =>
  apiFetch(`/booker/movies${qs(params)}`, { token })

export const fetchBookerMovieFilters = (token) =>
  apiFetch('/booker/movies/filters', { token })

export const fetchBookerMovieDetail = (movieId, token) =>
  apiFetch(`/booker/movies/${movieId}`, { token })

export const fetchBookerMovieShows = (movieId, params = {}, token) =>
  apiFetch(`/booker/movies/${movieId}/shows${qs(params)}`, { token })
