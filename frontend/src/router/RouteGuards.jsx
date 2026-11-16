import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NoticePage from '../pages/NoticePage'

export function RequireBooker() {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="auth-layout">
        <div className="card loading-card">Checking your session...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role !== 'TICKET_BOOKER') {
    return (
      <div className="auth-layout">
        <NoticePage
          title="Ticket Booking App"
          message="Admin and Theatre Owner accounts must use the Owner Portal at http://localhost:5174"
        />
      </div>
    )
  }

  return <Outlet />
}

export function GuestOnly() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) {
    return (
      <div className="auth-layout">
        <div className="card loading-card">Checking your session...</div>
      </div>
    )
  }
  if (user) {
    if (user.role === 'TICKET_BOOKER') {
      const from = location.state?.from
      const to = from ? `${from.pathname || '/'}${from.search || ''}${from.hash || ''}` : '/'
      return <Navigate to={to} replace />
    }
    return (
      <div className="auth-layout">
        <NoticePage
          title="Ticket Booking App"
          message="Admin and Theatre Owner accounts must use the Owner Portal at http://localhost:5174"
        />
      </div>
    )
  }
  return <Outlet />
}
