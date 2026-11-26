export const API = 'http://localhost:8001'

let refreshPromise = null
let onAuthFailure = null

// The access token is stored in the browser as an HttpOnly cookie set by
// the FastAPI backend; the browser sends it automatically on API requests.
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

    return data.access_token
  })()

  return refreshPromise.finally(() => {
    refreshPromise = null
  })
}

// Single fetch wrapper for the whole app. Sends credentials so the
// browser attaches the HttpOnly access-token cookie; retries once after
// /auth/refresh on 401. `token` is only used by the social-login redirect,
// which receives the token in the URL hash.
export async function apiFetch(path, options = {}) {

  const { method = 'GET', body, token, retry = true } = options

  const url = buildUrl(path)

  let res

  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Unable to connect to the server. Please check your internet connection.')
  }

  const data = await parseResponse(res)

  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {

    try {

      await refreshAccessToken()

      return apiFetch(path, { ...options, retry: false })

    } catch (err) {

      if (onAuthFailure) onAuthFailure()

      throw err instanceof Error ? err : new Error(getApiErrorMessage(res, data))
    }
  }

  if (!res.ok) {

    throw new Error(getApiErrorMessage(res, data))
  }

  return data
}
