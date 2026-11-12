import { useState } from 'react'

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
import ShowsPage from './pages/ShowsPage'
import ProfilePage from './pages/ProfilePage'

import './App.css'

function Placeholder({ title, message, onBack }) {

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </header>
      <div className="panel empty-state">
        <p>This section will be implemented in a later stage.</p>
        {onBack && (
          <button className="btn-secondary" onClick={onBack}>
            Back
          </button>
        )}
      </div>
    </div>
  )
}

function Shell() {

  const { user, ready, logout } = useAuth()

  const [loginPage, setLoginPage] = useState('login')

  const [nav, setNav] = useState({ name: 'dashboard', theatreId: null })

  function go(name, theatreId = null) {

    setNav({ name, theatreId })
  }

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
        <Placeholder
          title="Add Screen"
          message="Screen and seat layout management will be available in a later stage."
          onBack={() => setNav({ name: 'details', theatreId: nav.theatreId })}
        />
      )}

      {nav.name === 'movies' && <MoviesPage />}
      {nav.name === 'shows' && <ShowsPage />}
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
    case 'shows': return 'Dashboard › Shows'
    case 'profile': return 'Dashboard › Profile'
    default: return 'Dashboard'
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
