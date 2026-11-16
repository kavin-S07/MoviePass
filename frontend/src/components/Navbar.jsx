import { useEffect, useRef, useState } from 'react'
import logo from '../assets/logo.jpeg'

export default function Navbar({
  user,
  currentView,
  onNavigate,
  onLogout,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  city,
  cities = [],
  onCityChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const navItem = (view, label) => (
    <button
      type="button"
      className={`nav-link ${currentView === view ? 'active' : ''}`}
      onClick={() => onNavigate(view)}
    >
      {label}
    </button>
  )

  return (
    <header className="top-navbar">
      <div className="nav-left">
        <button type="button" className="brand-btn" onClick={() => onNavigate('home')}>
          <img src={logo} alt="MoviePass" className="nav-logo" />
          <span>MoviePass</span>
        </button>
        <nav className="nav-links">
          {navItem('home', 'Home')}
          {navItem('movies', 'Movies')}
          {navItem('bookings', 'My Bookings')}
        </nav>
      </div>

      <form className="nav-search" onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.() }}>
        <input
          type="text"
          placeholder="Search movies..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="nav-right">
        <select className="city-select" value={city || ''} onChange={(e) => onCityChange(e.target.value || '')}>
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className={`icon-btn ${currentView === 'notifications' ? 'active' : ''}`} title="Notifications" onClick={() => onNavigate('notifications')}>
          🔔
        </button>
        <div className="profile-menu-wrap" ref={menuRef}>
          <button type="button" className="profile-btn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar-circle">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
            <span className="profile-name">{user?.name || 'User'}</span>
          </button>
          {menuOpen && (
            <div className="profile-dropdown">
              <div className="profile-meta">
                <strong>{user?.name}</strong>
                <small>{user?.email}</small>
                <small>Role: {user?.role}</small>
              </div>
              <button type="button" onClick={() => { setMenuOpen(false); onNavigate('profile') }}>Profile</button>
              <button type="button" onClick={() => { setMenuOpen(false); onNavigate('bookings') }}>My Bookings</button>
              <button type="button" className="danger" onClick={onLogout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
