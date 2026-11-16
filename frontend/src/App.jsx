import { useCallback, useEffect, useState } from 'react'

import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import NoticePage from './pages/NoticePage'
import BookerHomePage from './pages/BookerHomePage'
import MoviesPage from './pages/MoviesPage'
import MovieDetailsPage from './pages/MovieDetailsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import BookerProfilePage from './pages/BookerProfilePage'
import { fetchBookerHome, fetchBookerMovieDetail, fetchBookerMovieFilters, fetchBookerMovies } from './services/booker'

import './App.css'

function AuthScreen() {
  const [page, setPage] = useState('login')
  return (
    <div className="auth-layout">
      {page === 'signup'
        ? <SignupPage onSwitch={() => setPage('login')} />
        : <LoginPage onSwitch={() => setPage('signup')} />}
    </div>
  )
}

function BookerApp() {
  const { user, token, logout } = useAuth()
  const [view, setView] = useState('home')
  const [selectedMovieId, setSelectedMovieId] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [movieSearch, setMovieSearch] = useState('')
  const [city, setCity] = useState('')
  const [filtersMeta, setFiltersMeta] = useState({ languages: [], genres: [], certifications: [], cities: [] })

  const [homeData, setHomeData] = useState(null)
  const [homeLoading, setHomeLoading] = useState(false)
  const [homeError, setHomeError] = useState('')

  const loadHome = useCallback(async () => {
    setHomeLoading(true)
    setHomeError('')
    try {
      const data = await fetchBookerHome(city ? { city } : {}, token)
      setHomeData(data)
      if (data?.filters) setFiltersMeta(data.filters)
    } catch (err) {
      setHomeError(err.message || 'Failed to load dashboard')
    } finally {
      setHomeLoading(false)
    }
  }, [city, token])

  useEffect(() => {
    let cancelled = false
    async function loadFilters() {
      try {
        const data = await fetchBookerMovieFilters(token)
        if (!cancelled) setFiltersMeta(data)
      } catch {
        // home load may populate filters; ignore here
      }
    }
    loadFilters()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (view === 'home') loadHome()
  }, [view, loadHome])

  const moviesFetcher = useCallback((params) => fetchBookerMovies(params, token), [token])
  const detailFetcher = useCallback((movieId) => fetchBookerMovieDetail(movieId, token), [token])

  function navigate(nextView, payload = null) {
    if (nextView === 'movie-details') {
      setSelectedMovieId(payload)
      setView('movie-details')
      return
    }
    if (nextView === 'movies') {
      if (typeof payload === 'string') {
        setSearchInput(payload)
        setMovieSearch(payload)
      }
      setView('movies')
      return
    }
    setView(nextView)
  }

  function handleSearchSubmit() {
    const term = searchInput.trim()
    setMovieSearch(term)
    setView('movies')
  }

  function handleViewDetails(movie) {
    if (!movie?.movie_id) return
    setSelectedMovieId(movie.movie_id)
    setView('movie-details')
  }

  function handleBook(movie) {
    // Stage 2: booking flow not implemented yet; take user to details/availability context.
    handleViewDetails(movie)
  }

  let content = null
  if (view === 'home') {
    content = (
      <BookerHomePage
        data={homeData}
        loading={homeLoading}
        error={homeError}
        onRetry={loadHome}
        onViewDetails={handleViewDetails}
        onBook={handleBook}
      />
    )
  } else if (view === 'movies') {
    content = (
      <MoviesPage
        key={`${city}|${movieSearch}`}
        initialSearch={movieSearch}
        city={city}
        filterOptions={filtersMeta}
        fetchMovies={moviesFetcher}
        onViewDetails={handleViewDetails}
        onBook={handleBook}
      />
    )
  } else if (view === 'movie-details' && selectedMovieId) {
    content = (
      <MovieDetailsPage
        movieId={selectedMovieId}
        fetchDetail={detailFetcher}
        onBack={() => setView('movies')}
        onBook={handleBook}
      />
    )
  } else if (view === 'bookings') {
    content = (
      <PlaceholderPage
        title="My Bookings"
        description="Booking history and ticket access will be implemented in upcoming stages. Once bookings are available, you will be able to view confirmations and digital tickets here."
      />
    )
  } else if (view === 'notifications') {
    content = (
      <PlaceholderPage
        title="Notifications"
        description="In-app notifications are not implemented yet. Booking and ticket updates will appear here in a future stage."
      />
    )
  } else if (view === 'profile') {
    content = <BookerProfilePage user={user} onLogout={logout} />
  } else {
    content = <PlaceholderPage title="Page not available" description="The requested view could not be found." />
  }

  return (
    <div className="booker-app">
      <Navbar
        user={user}
        currentView={view === 'movie-details' ? 'movies' : view}
        onNavigate={navigate}
        onLogout={logout}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        city={city}
        cities={filtersMeta.cities || []}
        onCityChange={setCity}
      />
      <main className="booker-main">{content}</main>
    </div>
  )
}

function Shell() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="auth-layout">
        <div className="card loading-card">Checking your session...</div>
      </div>
    )
  }

  if (user) {
    if (user.role === 'TICKET_BOOKER') {
      return <BookerApp />
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

  return <AuthScreen />
}

function App() {
  return (
    <AuthProvider kind="booker">
      <Shell />
    </AuthProvider>
  )
}

export default App
