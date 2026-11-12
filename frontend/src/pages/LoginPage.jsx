import { useState } from 'react'

import { useAuth } from '../context/AuthContext'

import SocialButtons from '../components/SocialButtons'

import logo from '../assets/logo.jpeg'

export default function LoginPage({ onSwitch }) {

  const { login, landingError } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })

  const [error, setError] = useState('')

  function change(e) {

    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {

    e.preventDefault()

    setError('')

    try {

      await login(form)

    } catch (err) {

      setError(err.message || 'Login failed')
    }
  }

  return (
    <div className="card">
      <img src={logo} className="logo-img" alt="MoviePass" />
      <h1 className="logo">Login to MoviePass</h1>

      {landingError && <p className="error">{landingError}</p>}

      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={change} />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={change} />

        {error && <p className="error">{error}</p>}

        <button type="submit">Login</button>
      </form>

      <SocialButtons />

      <p className="switch">
        Don't have an account?{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); onSwitch() }}>Signup</a>
      </p>
    </div>
  )
}
