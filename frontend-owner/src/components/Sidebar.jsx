import { useState } from 'react'
import logo from '../assets/logo.jpeg'
import { Icon, initialsOf } from './navIcons'

const OWNER_LINKS = [
  { section: 'Overview', key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { section: 'Manage', key: 'theatres', label: 'Theatres', icon: 'theatres' },
  { section: 'Manage', key: 'screens', label: 'Screens', icon: 'screens' },
  { section: 'Manage', key: 'movies', label: 'Movies', icon: 'movies' },
  { section: 'Manage', key: 'shows', label: 'Shows', icon: 'shows' },
  { section: 'Account', key: 'profile', label: 'Profile', icon: 'profile' },
]

const ADMIN_LINKS = [
  { section: 'Overview', key: 'overview', label: 'Overview', icon: 'dashboard' },
  { section: 'Review', key: 'approvals', label: 'Owner Approvals', icon: 'approvals' },
  { section: 'Manage', key: 'users', label: 'Users', icon: 'users' },
  { section: 'Manage', key: 'theatres', label: 'Theatres', icon: 'theatres' },
  { section: 'Manage', key: 'movies', label: 'Movies', icon: 'movies' },
  { section: 'Manage', key: 'shows', label: 'Shows', icon: 'shows' },
]

const STORAGE_KEY = 'owner.sidebar.collapsed'

function readCollapsed() {

  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function groupBySection(links) {

  const groups = []

  links.forEach((link) => {
    const last = groups[groups.length - 1]
    if (last && last.section === link.section) last.items.push(link)
    else groups.push({ section: link.section, items: [link] })
  })

  return groups
}

export function roleLabel(role) {

  if (role === 'ADMIN') return 'Administrator'
  if (role === 'THEATRE_OWNER') return 'Theatre Owner'
  return role || ''
}

// Collapsible sidebar (desktop) / slide-in drawer (mobile)
export default function Sidebar({ active, onNavigate, onLogout, user, links, title, mobileOpen = false, onClose }) {

  const [collapsed, setCollapsed] = useState(readCollapsed)

  const isAdmin = user?.role === 'ADMIN'
  const navLinks = links || (isAdmin ? ADMIN_LINKS : OWNER_LINKS)
  const brandTitle = title || (isAdmin ? 'Admin Portal' : 'Owner Portal')
  const groups = groupBySection(navLinks)

  function toggle() {

    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // storage unavailable - ignore
      }
      return next
    })
  }

  function go(key) {

    onNavigate(key)
    if (onClose) onClose()
  }

  return (
    <aside
      id="app-sidebar"
      className={`sb ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sb-brand">
        <img className="sb-logo" src={logo} alt="MoviePass" />
        <div className="sb-brand-text">
          <span className="sb-brand-name">MoviePass</span>
          <span className="sb-brand-sub">{brandTitle}</span>
        </div>
        <button
          type="button"
          className="sb-toggle"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={16} />
        </button>
        <button type="button" className="sb-close" onClick={onClose} aria-label="Close menu">
          <Icon name="close" size={18} />
        </button>
      </div>

      <nav className="sb-nav">
        {groups.map((group) => (
          <div className="sb-group" key={group.section}>
            <div className="sb-group-label">{group.section}</div>
            {group.items.map((link) => {

              const isActive = active === link.key

              return (
                <button
                  type="button"
                  key={link.key}
                  className={`sb-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => go(link.key)}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? link.label : undefined}
                >
                  <span className="sb-item-icon">
                    {typeof link.icon === 'string' ? <Icon name={link.icon} size={20} /> : link.icon}
                  </span>
                  <span className="sb-item-label">{link.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        {user && (
          <div className="sb-user">
            <span className="sb-avatar" aria-hidden="true">{initialsOf(user.name)}</span>
            <div className="sb-user-text">
              <div className="sb-user-name">{user.name}</div>
              <div className="sb-user-role">{roleLabel(user.role)}</div>
            </div>
          </div>
        )}
        <button type="button" className="sb-logout" onClick={onLogout} title={collapsed ? 'Logout' : undefined}>
          <Icon name="logout" size={18} />
          <span className="sb-logout-text">Logout</span>
        </button>
      </div>
    </aside>
  )
}
