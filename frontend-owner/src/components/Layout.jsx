import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

// App shell: sidebar + top navbar + scrolling content
export default function Layout({ active, onNavigate, onLogout, user, children, breadcrumb, links, title }) {

  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the mobile drawer with Escape
  useEffect(() => {

    if (!drawerOpen) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }

    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        onLogout={onLogout}
        user={user}
        links={links}
        title={title}
        mobileOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {drawerOpen && <div className="sb-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <div className="app-body">
        <Navbar
          breadcrumb={breadcrumb}
          user={user}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onMenu={() => setDrawerOpen(true)}
          menuOpen={drawerOpen}
        />
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
