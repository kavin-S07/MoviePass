const API = 'http://localhost:8000'

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

  return res.json().catch(() => ({}))
}

function errorMessage(data, fallback = 'Request failed') {

  const detail = data?.detail

  if (Array.isArray(detail)) {

    return detail[0]?.msg || detail[0] || fallback
  }

  return detail || fallback
}

export function refreshAccessToken() {

  if (refreshPromise) {

    return refreshPromise
  }

  refreshPromise = (async () => {

    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    const data = await parseResponse(res)

    if (!res.ok || !data?.access_token) {

      throw new Error(errorMessage(data, 'Session expired'))
    }

    setAccessToken(data.access_token)

    return data.access_token
  })()

  return refreshPromise.finally(() => {
    refreshPromise = null
  })
}

// Single fetch wrapper for the whole app. Includes credentials for
// HttpOnly refresh cookies and retries once after /auth/refresh on 401.
export async function apiFetch(path, options = {}) {

  const { method = 'GET', body, token, retry = true } = options

  const effectiveToken = token !== undefined ? token : accessToken
  const url = buildUrl(path)

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await parseResponse(res)

  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {

    try {

      const newToken = await refreshAccessToken()

      return apiFetch(path, { ...options, token: newToken, retry: false })

    } catch {

      clearAccessToken()
      if (onAuthFailure) onAuthFailure()

      throw new Error(errorMessage(data, 'Invalid or expired token'))
    }
  }

  if (!res.ok) {

    throw new Error(errorMessage(data))
  }

  return data
}
