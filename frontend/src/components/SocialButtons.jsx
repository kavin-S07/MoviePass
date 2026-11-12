import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { GoogleIcon } from './icons'

const PROVIDERS = [
  { name: 'google', label: 'Google', Icon: GoogleIcon },
]

// Buttons that redirect the browser to the FastAPI OAuth start endpoint.
// FastAPI handles the provider redirect and the callback.
export default function SocialButtons() {

  const { kind } = useAuth()

  const [loading, setLoading] = useState('')

  function go(provider) {

    if (loading) return

    setLoading(provider)

    window.location.assign(`http://localhost:8000/auth/${provider}?app=${kind}`)
  }

  return (
    <>
      <div className="divider"><span>OR CONTINUE WITH</span></div>

      <div className="social-row">
        {PROVIDERS.map(({ name, label, Icon }) => (
          <button
            key={name}
            type="button"
            className="social-btn"
            title={`Continue with ${label}`}
            aria-label={`Continue with ${label}`}
            disabled={!!loading}
            onClick={() => go(name)}
          >
            <Icon />
          </button>
        ))}
      </div>

      {loading && <p className="social-status">Redirecting to {loading}...</p>}
    </>
  )
}
