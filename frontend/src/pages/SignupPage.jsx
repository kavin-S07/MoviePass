import { useState } from 'react'

import { useAuth } from '../context/AuthContext'

import SocialButtons from '../components/SocialButtons'

import logo from '../assets/logo.jpeg'

export default function SignupPage({ onSwitch }) {

  const { signup, landingError } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone_no: '',
  })

  const [error, setError] = useState('')

  function change(e) {

    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {

    e.preventDefault()

    setError('')

    try {

      await signup(form)

    } catch (err) {

      setError(err.message || 'Signup failed')
    }
  }

  return (
    <div className="card">
      <img src={logo} className="logo-img" alt="MoviePass" />
      <h1 className="logo">Signup to MoviePass</h1>

      {landingError && <p className="error">{landingError}</p>}

      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Name" value={form.name} onChange={change} />
        <input name="phone_no" placeholder="Phone number (10 digits)" value={form.phone_no} onChange={change} />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={change} />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={change} />

        {error && <p className="error">{error}</p>}

        <button type="submit">Signup</button>
      </form>

      <SocialButtons />

      <p className="switch">
        Already have an account?{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); onSwitch() }}>Login</a>
      </p>
    </div>
  )
}
