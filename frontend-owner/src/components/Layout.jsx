import Sidebar from './Sidebar'

// App shell: fixed sidebar + scrolling main content
export default function Layout({ active, onNavigate, onLogout, user, children, breadcrumb }) {

  return (
    <div className="owner-shell">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        onLogout={onLogout}
        user={user}
      />
      <main className="owner-main">
        {breadcrumb && (
          <div className="breadcrumb">{breadcrumb}</div>
        )}
        {children}
      </main>
    </div>
  )
}
