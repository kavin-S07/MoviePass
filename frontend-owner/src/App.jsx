import { useEffect, useState } from 'react'

import { AuthProvider, useAuth } from './context/AuthContext'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import NoticePage from './pages/NoticePage'
import Layout from './components/Layout'

import DashboardPage from './pages/DashboardPage'
import TheatresPage from './pages/TheatresPage'
import TheatreDetailsPage from './pages/TheatreDetailsPage'
import TheatreFormPage from './pages/TheatreFormPage'
import MoviesPage from './pages/MoviesPage'
import MovieFormPage from './pages/MovieFormPage'
import MovieDetailsPage from './pages/MovieDetailsPage'
import ShowsPage from './pages/ShowsPage'
import ShowFormPage from './pages/ShowFormPage'
import ProfilePage from './pages/ProfilePage'
import AddScreenPage from './pages/AddScreenPage'
import AdminOverviewPage from './pages/AdminOverviewPage'
import AdminApprovalsPage from './pages/AdminApprovalsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminTheatresPage from './pages/AdminTheatresPage'
import AdminMoviesPage from './pages/AdminMoviesPage'
import AdminShowsPage from './pages/AdminShowsPage'

import './App.css'

const ADMIN_NAMES = new Set(['overview', 'approvals', 'users', 'theatres', 'movies', 'shows'])

function parseNavFromPath(pathname, role) {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (role === 'ADMIN') {
    if (path === '/admin' || path === '/admin/' || path === '/admin/overview') return { name: 'overview', theatreId: null }
    if (path === '/admin/approvals') return { name: 'approvals', theatreId: null }
    if (path === '/admin/users') return { name: 'users', theatreId: null }
    if (path === '/admin/theatres') return { name: 'theatres', theatreId: null }
    if (path === '/admin/movies') return { name: 'movies', theatreId: null }
    if (path === '/admin/shows') return { name: 'shows', theatreId: null }
    // Default admin landing
    if (path === '/' || path.startsWith('/admin')) return { name: 'overview', theatreId: null }
  }

  if (path === '/' || path === '/owner' || path === '/owner/dashboard') return { name: 'dashboard', theatreId: null }
  if (path === '/owner/theatres') return { name: 'theatres', theatreId: null }
  if (path === '/owner/theatres/add') return { name: 'add-theatre', theatreId: null }
  if (path === '/owner/movies') return { name: 'movies', theatreId: null }
  if (path === '/owner/movies/add') return { name: 'add-movie', theatreId: null }
  if (path === '/owner/shows') return { name: 'shows', theatreId: null }
  if (path === '/owner/shows/add') return { name: 'add-show', theatreId: null }
  if (path === '/owner/profile') return { name: 'profile', theatreId: null }

  let match = path.match(/^\/owner\/theatres\/([^/]+)\/screens\/add$/)
  if (match) return { name: 'add-screen', theatreId: match[1] }

  match = path.match(/^\/owner\/theatres\/([^/]+)\/edit$/)
  if (match) return { name: 'edit-theatre', theatreId: match[1] }

  match = path.match(/^\/owner\/theatres\/([^/]+)$/)
  if (match) return { name: 'details', theatreId: match[1] }

  match = path.match(/^\/owner\/movies\/([^/]+)\/edit$/)
  if (match) return { name: 'edit-movie', theatreId: match[1] }

  match = path.match(/^\/owner\/movies\/([^/]+)$/)
  if (match) return { name: 'movie-details', theatreId: match[1] }

  return null
}

function pathForNav(name, theatreId = null, role) {
  if (role === 'ADMIN' || ADMIN_NAMES.has(name)) {
    switch (name) {
      case 'overview': return '/admin/overview'
      case 'approvals': return '/admin/approvals'
      case 'users': return '/admin/users'
      case 'theatres': return '/admin/theatres'
      case 'movies': return '/admin/movies'
      case 'shows': return '/admin/shows'
      default: return '/admin/overview'
    }
  }

  switch (name) {
    case 'dashboard': return '/owner/dashboard'
    case 'theatres': return '/owner/theatres'
    case 'add-theatre': return '/owner/theatres/add'
    case 'edit-theatre': return `/owner/theatres/${theatreId}/edit`
    case 'details': return `/owner/theatres/${theatreId}`
    case 'add-screen': return `/owner/theatres/${theatreId}/screens/add`
    case 'movies': return '/owner/movies'
    case 'add-movie': return '/owner/movies/add'
    case 'edit-movie': return `/owner/movies/${theatreId}/edit`
    case 'movie-details': return `/owner/movies/${theatreId}`
    case 'shows': return '/owner/shows'
    case 'add-show': return '/owner/shows/add'
    case 'profile': return '/owner/profile'
    default: return '/owner/dashboard'
  }
}

function defaultNavForUser(user) {
  if (user?.role === 'ADMIN') return { name: 'overview', theatreId: null }
  return { name: 'dashboard', theatreId: null }
}

function Shell() {

  const { user, ready, logout } = useAuth()

  const [loginPage, setLoginPage] = useState('login')

  const [nav, setNav] = useState(() => parseNavFromPath(window.location.pathname, null) || { name: 'dashboard', theatreId: null })

  function go(name, theatreId = null, options = {}) {
    const next = { name, theatreId }
    setNav(next)
    if (!user) return
    const path = pathForNav(name, theatreId, user.role)
    if (window.location.pathname !== path) {
      if (options.replace) {
        window.history.replaceState({}, '', path)
      } else {
        window.history.pushState({}, '', path)
      }
    }
  }

  useEffect(() => {
    function onPopState() {
      if (!user) return
      const parsed = parseNavFromPath(window.location.pathname, user.role)
      if (parsed) {
        setNav(parsed)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [user])

  useEffect(() => {
    if (!ready || !user) return

    // Keep nav aligned with role and URL for deep links/refresh.
    const parsed = parseNavFromPath(window.location.pathname, user.role)
    if (parsed) {
      setNav((prev) => (prev.name === parsed.name && String(prev.theatreId ?? '') === String(parsed.theatreId ?? '') ? prev : parsed))
      return
    }

    // Unknown path for this role -> go to role default and normalize URL.
    const fallback = defaultNavForUser(user)
    setNav(fallback)
    const path = pathForNav(fallback.name, fallback.theatreId, user.role)
    if (window.location.pathname !== path) {
      window.history.replaceState({}, '', path)
    }
  }, [ready, user])

  useEffect(() => {
    if (!ready || !user) return
    const isApprovedOwner = user.role === 'THEATRE_OWNER' && user.approval_status === 'APPROVED'
    const isAdmin = user.role === 'ADMIN'
    if (!isApprovedOwner && !isAdmin) return

    const path = pathForNav(nav.name, nav.theatreId, user.role)
    if (window.location.pathname !== path) {
      window.history.replaceState({}, '', path)
    }
  }, [ready, user, nav.name, nav.theatreId])

  // Wait until authentication restoration finishes
  if (!ready) {

    return (
      <div className="loading-screen">
        Checking your session...
      </div>
    )
  }

  // Not signed in -> show auth screens
  if (!user) {

    if (loginPage === 'signup') {

      return <SignupPage onSwitch={() => setLoginPage('login')} />
    }

    return <LoginPage onSwitch={() => setLoginPage('signup')} />
  }

  // Signed-in routing by role and approval status
  if (user.role === 'ADMIN') {
    const adminActive = ['overview', 'approvals', 'users', 'theatres', 'movies', 'shows'].includes(nav.name)
      ? nav.name
      : 'overview'

    return (
      <Layout
        active={adminActive}
        onNavigate={(name) => go(name)}
        onLogout={logout}
        user={user}
        breadcrumb={buildAdminBreadcrumb(adminActive)}
      >
        {adminActive === 'overview' && <AdminOverviewPage onNavigate={go} />}
        {adminActive === 'approvals' && <AdminApprovalsPage />}
        {adminActive === 'users' && <AdminUsersPage />}
        {adminActive === 'theatres' && <AdminTheatresPage />}
        {adminActive === 'movies' && <AdminMoviesPage />}
        {adminActive === 'shows' && <AdminShowsPage />}
      </Layout>
    )
  }

  if (user.role !== 'THEATRE_OWNER') {

    return (
      <NoticePage
        title="Owner Portal"
        message="Ticket Bookers use the customer app at http://localhost:5173"
      />
    )
  }

  if (user.approval_status === 'REJECTED') {

    return (
      <NoticePage
        title="Application Rejected"
        message="Your Theatre Owner application was rejected. Please contact the administrator."
      />
    )
  }

  if (user.approval_status === 'PENDING' || !user.approval_status) {

    return (
      <NoticePage
        title="Application Under Review"
        message="Your Theatre Owner application is awaiting Admin approval. You will be able to access your dashboard once it is approved."
      />
    )
  }

  const activeTab = ['add-theatre', 'edit-theatre', 'details', 'add-screen'].includes(nav.name)
    ? 'theatres'
    : ['add-movie', 'edit-movie', 'movie-details'].includes(nav.name)
      ? 'movies'
      : nav.name === 'add-show'
        ? 'shows'
        : nav.name

  const activeNav = ['dashboard', 'theatres', 'movies', 'shows', 'profile'].includes(activeTab)
    ? activeTab
    : 'dashboard'

  return (
    <Layout
      active={activeNav}
      onNavigate={(name) => go(name)}
      onLogout={logout}
      user={user}
      breadcrumb={buildBreadcrumb(nav.name, nav.theatreId)}
    >
      {nav.name === 'dashboard' && <DashboardPage onNavigate={go} />}

      {nav.name === 'theatres' && <TheatresPage onNavigate={go} />}

      {nav.name === 'add-theatre' && (
        <TheatreFormPage
          onDone={({ saved, theatreId } = {}) => {
            setNav(saved
              ? { name: 'details', theatreId }
              : { name: 'theatres', theatreId: null })
          }}
        />
      )}

      {nav.name === 'edit-theatre' && (
        <TheatreFormPage
          theatreId={nav.theatreId}
          onDone={({ saved } = {}) => {
            setNav(saved
              ? { name: 'theatres', theatreId: null }
              : { name: 'details', theatreId: nav.theatreId })
          }}
        />
      )}

      {nav.name === 'details' && (
        <TheatreDetailsPage theatreId={nav.theatreId} onNavigate={go} />
      )}

      {nav.name === 'add-screen' && (
        <AddScreenPage
          theatreId={nav.theatreId}
          onDone={() => setNav({ name: 'details', theatreId: nav.theatreId })}
        />
      )}
      {nav.name === 'movies' && <MoviesPage onNavigate={go} />}
      {nav.name === 'add-movie' && (
        <MovieFormPage
          onDone={() => setNav({ name: 'movies', theatreId: null })}
        />
      )}
      {nav.name === 'edit-movie' && (
        <MovieFormPage
          movieId={nav.theatreId}
          onDone={() => setNav({ name: 'movies', theatreId: null })}
        />
      )}
      {nav.name === 'movie-details' && (
        <MovieDetailsPage movieId={nav.theatreId} onNavigate={go} />
      )}
      {nav.name === 'shows' && <ShowsPage onNavigate={go} />}
      {nav.name === 'add-show' && (
        <ShowFormPage
          onDone={() => setNav({ name: 'shows', theatreId: null })}
        />
      )}
      {nav.name === 'profile' && <ProfilePage />}
    </Layout>
  )
}

function buildBreadcrumb(name, theatreId) {

  switch (name) {
    case 'dashboard': return 'Dashboard'
    case 'theatres': return 'Dashboard › Theatres'
    case 'add-theatre': return 'Dashboard › Theatres › Add Theatre'
    case 'edit-theatre': return 'Dashboard › Theatres › Edit Theatre'
    case 'details': return `Dashboard › Theatres › Theatre #${theatreId}`
    case 'add-screen': return 'Dashboard › Theatres › Add Screen'
    case 'movies': return 'Dashboard › Movies'
    case 'add-movie': return 'Dashboard › Movies › Add Movie'
    case 'edit-movie': return 'Dashboard › Movies › Edit Movie'
    case 'movie-details': return `Dashboard › Movies › Movie #${theatreId || ''}`.trim()
    case 'shows': return 'Dashboard › Shows'
    case 'add-show': return 'Dashboard › Shows › Schedule Show'
    case 'profile': return 'Dashboard › Profile'
    default: return 'Dashboard'
  }
}

function buildAdminBreadcrumb(name) {
  switch (name) {
    case 'overview': return 'Admin › Overview'
    case 'approvals': return 'Admin › Owner Approvals'
    case 'users': return 'Admin › Users'
    case 'theatres': return 'Admin › Theatres'
    case 'movies': return 'Admin › Movies'
    case 'shows': return 'Admin › Shows'
    default: return 'Admin › Overview'
  }
}

function App() {

  return (
    <AuthProvider kind="owner">
      <Shell />
    </AuthProvider>
  )
}

export default App
