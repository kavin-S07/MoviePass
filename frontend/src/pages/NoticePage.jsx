import { useAuth } from '../context/AuthContext'

import logo from '../assets/logo.jpeg'

// Simple generic notice page: used for "this app is for other roles",
// "awaiting approval", "rejected" and similar messages.
export default function NoticePage({ title, message, actionLabel = 'Logout' }) {

  const { logout } = useAuth()

  return (
    <div className="card">
      <img src={logo} className="logo-img" alt="MoviePass" />
      <h1>{title}</h1>
      <p>{message}</p>
      <button onClick={logout}>{actionLabel}</button>
    </div>
  )
}
