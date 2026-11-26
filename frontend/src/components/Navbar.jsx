import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.jpeg'

export default function Navbar({
  user,
  onLogout,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  city,
  cities = [],
  onCityChange,
  unreadCount = 0,
  onNavigate,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const inMoviesSection = location.pathname === '/movies' || location.pathname.startsWith('/movies/') || location.pathname.startsWith('/shows/') || location.pathname === '/checkout' || location.pathname === '/payment-result'
  const inBookingsSection = location.pathname === '/bookings' || location.pathname.startsWith('/bookings/')

  // All in-app navigation goes through onNavigate so the layout can intercept it (e.g. mid-payment).
  const go = (to) => (onNavigate ? onNavigate(to) : navigate(to))
  const linkClick = (to) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return // let new-tab clicks through
    e.preventDefault()
    go(to)
  }
  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`

  return (
    <header className="top-navbar">
      <div className="nav-left">
        <button type="button" className="brand-btn" onClick={() => go('/')} aria-label="MoviePass home">
          <img src={logo} alt="MoviePass" className="nav-logo" />
        </button>
        <nav className="nav-links" aria-label="Primary">
          <NavLink to="/" end className={linkClass} onClick={linkClick('/')}>Home</NavLink>
          <NavLink to="/movies" onClick={linkClick('/movies')} className={() => `nav-link ${inMoviesSection ? 'active' : ''}`}>Movies</NavLink>
          <NavLink to="/bookings" onClick={linkClick('/bookings')} className={() => `nav-link ${inBookingsSection ? 'active' : ''}`}>Bookings</NavLink>
        </nav>
      </div>

      <div className="nav-center">
        <form className="nav-search" onSubmit={(e) => { e.preventDefault(); onSearchSubmit() }}>
          <input
            type="text"
            placeholder="Search movies..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="nav-right">
        <select className="city-select" value={city} onChange={(e) => onCityChange(e.target.value)} aria-label="Select city">
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          type="button"
          className={`icon-btn notif-btn ${location.pathname === '/notifications' ? 'active' : ''}`}
          title="Notifications"
          onClick={() => go('/notifications')}
        >
          <span aria-hidden="true">🔔</span>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>

        <div className="profile-menu-wrap" ref={menuRef}>
          <button type="button" className="profile-btn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar-circle">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
            <span className="profile-name">{user?.name || 'Profile'}</span>
          </button>
          {menuOpen && (
            <div className="profile-dropdown">
              <div className="profile-meta">
                <strong>{user?.name}</strong>
                <small>{user?.email}</small>
              </div>
              <button type="button" onClick={() => { setMenuOpen(false); go('/profile') }}>View Profile</button>
              <button type="button" onClick={() => { setMenuOpen(false); go('/bookings') }}>My Bookings</button>
              <button type="button" onClick={() => { setMenuOpen(false); go('/notifications') }}>Notifications</button>
              <button type="button" className="danger" onClick={() => { setMenuOpen(false); onLogout() }}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
