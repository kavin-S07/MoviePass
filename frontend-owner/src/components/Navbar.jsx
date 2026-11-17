import { useEffect, useRef, useState } from 'react'
import { Icon, initialsOf } from './navIcons'
import { roleLabel } from './Sidebar'

const QUICK_CREATE = [
  { label: 'Theatre', hint: 'Register a new venue', icon: 'theatres', go: ['add-theatre'] },
  { label: 'Screen', hint: 'Design a seat layout', icon: 'screens', go: ['screens', null, { picker: true }] },
  { label: 'Movie', hint: 'Add to your catalogue', icon: 'movies', go: ['add-movie'] },
  { label: 'Show', hint: 'Schedule a screening', icon: 'shows', go: ['add-show'] },
]

// Closes a popover on outside click or Escape
function useDismiss(open, onClose) {

  const ref = useRef(null)

  useEffect(() => {

    if (!open) return undefined

    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return ref
}

function Breadcrumbs({ trail }) {

  if (!trail.length) return null

  return (
    <nav className="nb-crumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((label, i) => {

          const last = i === trail.length - 1

          return (
            <li key={`${label}-${i}`} aria-current={last ? 'page' : undefined} className={last ? 'is-current' : ''}>
              {i > 0 && <span className="nb-sep" aria-hidden="true">/</span>}
              <span>{label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default function Navbar({ breadcrumb, user, onNavigate, onLogout, onMenu, menuOpen }) {

  const [createOpen, setCreateOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const createRef = useDismiss(createOpen, () => setCreateOpen(false))
  const userRef = useDismiss(userOpen, () => setUserOpen(false))

  const isAdmin = user?.role === 'ADMIN'
  const trail = breadcrumb ? String(breadcrumb).split('›').map((s) => s.trim()).filter(Boolean) : []

  return (
    <header className="nb">
      <button
        type="button"
        className="nb-menu"
        onClick={onMenu}
        aria-label="Open menu"
        aria-controls="app-sidebar"
        aria-expanded={menuOpen}
      >
        <Icon name="menu" size={20} />
      </button>

      <Breadcrumbs trail={trail} />

      <div className="nb-actions">
        {!isAdmin && (
          <div className="nb-pop" ref={createRef}>
            <button
              type="button"
              className="nb-create"
              onClick={() => { setCreateOpen((v) => !v); setUserOpen(false) }}
              aria-haspopup="menu"
              aria-expanded={createOpen}
            >
              <Icon name="plus" size={16} />
              <span>Create</span>
              <Icon name="chevron" size={14} className="nb-caret" />
            </button>

            {createOpen && (
              <div className="nb-menu-pop" role="menu">
                {QUICK_CREATE.map((item) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={item.label}
                    className="nb-menu-item"
                    onClick={() => {
                      setCreateOpen(false)
                      onNavigate(...item.go)
                    }}
                  >
                    <span className="nb-menu-icon"><Icon name={item.icon} size={18} /></span>
                    <span className="nb-menu-text">
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {user && (
          <div className="nb-pop" ref={userRef}>
            <button
              type="button"
              className="nb-user"
              onClick={() => { setUserOpen((v) => !v); setCreateOpen(false) }}
              aria-haspopup="menu"
              aria-expanded={userOpen}
            >
              <span className="nb-avatar" aria-hidden="true">{initialsOf(user.name)}</span>
              <span className="nb-user-text">
                <strong>{user.name}</strong>
                <small>{roleLabel(user.role)}</small>
              </span>
              <Icon name="chevron" size={14} className="nb-caret" />
            </button>

            {userOpen && (
              <div className="nb-menu-pop nb-menu-right" role="menu">
                <div className="nb-menu-head">
                  <strong>{user.name}</strong>
                  {user.email && <small>{user.email}</small>}
                </div>
                {!isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    className="nb-menu-item"
                    onClick={() => { setUserOpen(false); onNavigate('profile') }}
                  >
                    <span className="nb-menu-icon"><Icon name="profile" size={18} /></span>
                    <span className="nb-menu-text"><strong>My profile</strong></span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="nb-menu-item is-danger"
                  onClick={() => { setUserOpen(false); onLogout() }}
                >
                  <span className="nb-menu-icon"><Icon name="logout" size={18} /></span>
                  <span className="nb-menu-text"><strong>Logout</strong></span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
