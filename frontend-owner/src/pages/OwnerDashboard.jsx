import { useAuth } from '../context/AuthContext'

import logo from '../assets/logo.jpeg'

export default function OwnerDashboard() {

  const { user, logout } = useAuth()

  return (
    <div className="card">
      <img src={logo} className="logo-img" alt="MoviePass" />
      <h1>Theatre Owner Dashboard</h1>
      <p>Welcome, {user?.name}. Movie, theatre, screen, show and seat management will appear here.</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
