import { createContext, useContext, useEffect, useState } from 'react'

import {
  fetchHome,
  login as loginRequest,
  logout as logoutRequest,
  signupBooker,
  signupOwner,
  OAUTH_ERRORS,
} from '../services/auth'
import { setAuthFailureHandler } from '../services/api'

const AuthContext = createContext(null)

export function useAuth() {

  return useContext(AuthContext)
}

// kind: "booker" or "owner" - decides which signup endpoint is used.
// The login endpoint is the same for both applications.
export function AuthProvider({ children, kind }) {

  const [user, setUser] = useState(null)

  const [landingError, setLandingError] = useState('')

  const [ready, setReady] = useState(false)

  useEffect(() => {

    setAuthFailureHandler(() => {
      setUser(null)
    })

    return () => setAuthFailureHandler(null)
  }, [])

  // Handle social redirect or restore the session from the HttpOnly
  // cookies the browser sends on requests.
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

          const data = await fetchHome(accessTokenFromRedirect)

          if (!cancelled) {
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

        // Cookie-based session: no token is stored on the client. If the
        // access cookie is missing or expired, apiFetch retries through
        // /auth/refresh before surfacing a 401.
        const data = await fetchHome()

        if (!cancelled) {
          setUser(data.user)
        }

      } catch (err) {

        if (!cancelled) {
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

    setUser(data.user)

    return data
  }

  async function login(values) {

    const data = await loginRequest(values)

    setUser(data.user)

    return data
  }

  async function logout() {

    try {
      await logoutRequest()
    } catch {
      // Clear local session even if server logout fails.
    }

    setUser(null)
  }

  const value = { kind, user, landingError, ready, signup, login, logout, setUser }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
