import { useState } from 'react'
import logo from '../assets/logo.jpeg'

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
  ),
  theatres: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l2-3h12l2 3M8 18v2m8-2v2M9.5 11h5v5h-5z"
        stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  movies: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M4 5h16v14H4zM4 5l3-2 3 2M4 5l3 2 3-2M4 5l3-2 3 2"
        stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="11" r="1.6" fill="currentColor" />
      <circle cx="16" cy="11" r="1.6" fill="currentColor" />
      <rect x="10.2" y="14.6" width="3.6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  shows: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="15" r="2.2" fill="currentColor" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" fill="currentColor" />
      <path d="M4.5 20c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5" fill="currentColor" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M14 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 9l4 3-4 3M20 12H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  collapse: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  expand: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

const LINKS = [
  { key: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { key: 'theatres', label: 'Theatres', icon: ICONS.theatres },
  { key: 'movies', label: 'Movies', icon: ICONS.movies },
  { key: 'shows', label: 'Shows', icon: ICONS.shows },
  { key: 'profile', label: 'Profile', icon: ICONS.profile },
]

// Collapsible sidebar with app navigation
export default function Sidebar({ active, onNavigate, onLogout, user }) {

  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={logo} alt="MoviePass" />
        {!collapsed && <span className="sidebar-title">Owner Portal</span>}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? ICONS.expand : ICONS.collapse}
        </button>
      </div>

      <nav className="sidebar-nav">
        {LINKS.map((link) => (
          <button
            key={link.key}
            className={`sidebar-item ${active === link.key ? 'active' : ''}`}
            onClick={() => onNavigate(link.key)}
            title={collapsed ? link.label : ''}
          >
            <span className="sidebar-icon">{link.icon}</span>
            {!collapsed && <span>{link.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && user && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.role}</div>
          </div>
        )}
        <button
          className="sidebar-logout"
          onClick={onLogout}
          title="Logout"
        >
          {ICONS.logout}
          {!collapsed && <span className="sidebar-logout-text">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
