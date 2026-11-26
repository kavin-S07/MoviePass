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

export const fetchBookerHome = (params = {}) =>
  apiFetch(`/booker/home${qs(params)}`)

export const fetchBookerMovies = (params = {}) =>
  apiFetch(`/booker/movies${qs(params)}`)

export const fetchBookerMovieFilters = () =>
  apiFetch('/booker/movies/filters')

export const fetchBookerMovieDetail = (movieId) =>
  apiFetch(`/booker/movies/${movieId}`)

export const fetchBookerMovieShows = (movieId, params = {}) =>
  apiFetch(`/booker/movies/${movieId}/shows${qs(params)}`)

export const fetchBookerShowDiscovery = (movieId, params = {}) =>
  apiFetch(`/booker/movies/${movieId}/show-discovery${qs(params)}`)
