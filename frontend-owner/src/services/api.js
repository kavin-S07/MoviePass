export const API = 'http://localhost:8001'

let accessToken = ''
let refreshPromise = null
let onAuthFailure = null

export function setAccessToken(token) {

  accessToken = token || ''
}

export function getAccessToken() {

  return accessToken
}

export function clearAccessToken() {

  accessToken = ''
}

export function setAuthFailureHandler(handler) {

  onAuthFailure = handler
}

function buildUrl(path) {

  return API + path
}

async function parseResponse(res) {

  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return res.json().catch(() => ({}))
  }

  const text = await res.text().catch(() => '')
  return text ? { message: text } : {}
}

function extractBackendMessage(data) {

  if (!data || typeof data !== 'object') return ''

  const detail = data.detail

  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim()
  }

  if (Array.isArray(detail)) {
    const first = detail[0]

    if (typeof first === 'string' && first.trim()) return first.trim()
    if (first && typeof first === 'object') {
      if (typeof first.msg === 'string' && first.msg.trim()) return first.msg.trim()
      if (typeof first.message === 'string' && first.message.trim()) return first.message.trim()
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim()
  }

  return ''
}

function getRetryAfterSeconds(res) {

  const raw = res?.headers?.get?.('Retry-After')
  if (!raw) return null

  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)

  const dateMs = Date.parse(raw)
  if (Number.isFinite(dateMs)) {
    const diffSeconds = Math.ceil((dateMs - Date.now()) / 1000)
    return diffSeconds > 0 ? diffSeconds : 0
  }

  return null
}

function getStatusFallbackMessage(status) {

  if (status === 400) return 'Invalid request. Please check your input.'
  if (status === 401) return 'Invalid email or password.'
  if (status === 403) return "You don't have permission to perform this action."
  if (status === 404) return 'Requested resource not found.'
  if (status === 409) return 'This account already exists.'
  if (status === 422) return 'Please check the entered information.'
  if (status === 429) return 'Too many requests. Please wait before trying again.'
  if (status === 500) return 'Something went wrong on the server. Please try again later.'
  if (status === 502 || status === 503 || status === 504) return 'Service temporarily unavailable. Please try again later.'

  return 'Something went wrong. Please try again.'
}

export function getApiErrorMessage(res, data) {

  const status = res?.status
  const backendMessage = extractBackendMessage(data)

  if (status === 429) {
    const retryAfter = getRetryAfterSeconds(res)
    if (retryAfter !== null && retryAfter > 0) {
      const unit = retryAfter === 1 ? 'second' : 'seconds'
      return `Too many requests. Please wait ${retryAfter} ${unit} before trying again.`
    }
    return 'Too many requests. Please wait before trying again.'
  }

  if (status === 401) {
    return backendMessage || 'Invalid email or password.'
  }

  if (backendMessage) {
    return backendMessage
  }

  return getStatusFallbackMessage(status)
}

export function refreshAccessToken() {

  if (refreshPromise) {

    return refreshPromise
  }

  refreshPromise = (async () => {

    let res

    try {
      res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
    } catch {
      throw new Error('Unable to connect to the server. Please check your internet connection.')
    }

    const data = await parseResponse(res)

    if (!res.ok || !data?.access_token) {

      throw new Error(getApiErrorMessage(res, data) || 'Session expired')
    }

    setAccessToken(data.access_token)

    return data.access_token
  })()

  return refreshPromise.finally(() => {
    refreshPromise = null
  })
}

// Normalises a list response: a bare array, or an object wrapping the array
// under a common key (paginated `items`, `movies`, `data`, `results` ...).
const LIST_KEYS = ['items', 'movies', 'theatre_movies', 'data', 'results', 'records']

export function toList(data) {

  if (Array.isArray(data)) return data

  if (data && typeof data === 'object') {
    for (const key of LIST_KEYS) {
      if (Array.isArray(data[key])) return data[key]
    }
    if (import.meta.env?.DEV) {
      console.warn('[api] Unrecognised list response shape:', data)
    }
  }

  return []
}

// Single fetch wrapper for the whole app. Includes credentials for
// HttpOnly refresh cookies and retries once after /auth/refresh on 401.
export async function apiFetch(path, options = {}) {

  const { method = 'GET', body, token, retry = true } = options

  const effectiveToken = token !== undefined ? token : accessToken
  const url = buildUrl(path)

  let res

  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Unable to connect to the server. Please check your internet connection.')
  }

  const data = await parseResponse(res)

  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {

    try {

      const newToken = await refreshAccessToken()

      return apiFetch(path, { ...options, token: newToken, retry: false })

    } catch (err) {

      clearAccessToken()
      if (onAuthFailure) onAuthFailure()

      throw err instanceof Error ? err : new Error(getApiErrorMessage(res, data))
    }
  }

  if (!res.ok) {

    throw new Error(getApiErrorMessage(res, data))
  }

  return data
}
