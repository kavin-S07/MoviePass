import { useAuth } from '../context/AuthContext'

import logo from '../assets/logo.jpeg'

export default function HomePage() {

  const { user, token, logout } = useAuth()

  return (
    <div className="card">
      <img src={logo} className="logo-img" alt="MoviePass" />
      <h1>Welcome, {user?.name} to MoviePass web application</h1>
      <p className="token">Token: {token.slice(0, 20)}...</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
