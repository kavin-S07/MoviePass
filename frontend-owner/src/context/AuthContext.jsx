import { createContext, useContext, useEffect, useState } from 'react'

import {
  fetchHome,
  login as loginRequest,
  logout as logoutRequest,
  signupBooker,
  signupOwner,
  OAUTH_ERRORS,
} from '../services/auth'
import {
  clearAccessToken,
  refreshAccessToken,
  setAccessToken,
  setAuthFailureHandler,
} from '../services/api'

const AuthContext = createContext(null)

export function useAuth() {

  return useContext(AuthContext)
}

async function tryRestoreSession() {

  try {

    return await refreshAccessToken()
  } catch {

    return ''
  }
}

// kind: "booker" or "owner" - decides which signup endpoint is used.
// The login endpoint is the same for both applications.
export function AuthProvider({ children, kind }) {

  const [user, setUser] = useState(null)

  const [token, setToken] = useState('')

  const [landingError, setLandingError] = useState('')

  const [ready, setReady] = useState(false)

  useEffect(() => {

    setAuthFailureHandler(() => {
      clearAccessToken()
      setToken('')
      setUser(null)
    })

    return () => setAuthFailureHandler(null)
  }, [])

  // Handle social redirect or restore session from refresh cookie.
  useEffect(() => {

    let cancelled = false

    async function init() {

      try {

        const params = new URLSearchParams(
          window.location.hash.slice(1)
        )

        const accessTokenFromRedirect = params.get('access_token')
        const errorCode = params.get('error')

        if (accessTokenFromRedirect) {

          window.history.replaceState(null, '', window.location.pathname)

          setAccessToken(accessTokenFromRedirect)

          const data = await fetchHome(accessTokenFromRedirect)

          if (!cancelled) {
            setToken(accessTokenFromRedirect)
            setUser(data.user)
          }

          return
        }

        if (errorCode) {

          window.history.replaceState(null, '', window.location.pathname)

          if (!cancelled) {
            setLandingError(OAUTH_ERRORS[errorCode] || 'Social authentication failed.')
          }

          return
        }

        const restoredToken = await tryRestoreSession()

        if (!restoredToken || cancelled) return

        const data = await fetchHome(restoredToken)

        if (!cancelled) {
          setAccessToken(restoredToken)
          setToken(restoredToken)
          setUser(data.user)
        }

      } catch (err) {

        if (!cancelled) {
          clearAccessToken()
          setToken('')
          setUser(null)

          if (window.location.hash.includes('access_token=')) {
            setLandingError(err.message || 'Social authentication failed.')
          }
        }

      } finally {

        if (!cancelled) {
          setReady(true)
        }
      }
    }

    init()

    return () => { cancelled = true }
  }, [])

  const signupRequest = kind === 'owner' ? signupOwner : signupBooker

  async function signup(values) {

    const data = await signupRequest(values)

    setAccessToken(data.access_token)
    setToken(data.access_token)
    setUser(data.user)

    return data
  }

  async function login(values) {

    const data = await loginRequest(values)

    setAccessToken(data.access_token)
    setToken(data.access_token)
    setUser(data.user)

    return data
  }

  async function logout() {

    try {
      await logoutRequest()
    } catch {
      // Clear local session even if server logout fails.
    }

    clearAccessToken()
    setUser(null)
    setToken('')
  }

  const value = { kind, user, token, landingError, ready, signup, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
