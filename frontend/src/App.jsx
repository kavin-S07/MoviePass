import { useCallback, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AuthProvider, useAuth } from './context/AuthContext'
import { BookingFlowProvider, useBookingFlow } from './context/BookingFlowContext'
import { GuestOnly, RequireBooker } from './router/RouteGuards'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import BookerHomePage from './pages/BookerHomePage'
import MoviesPage from './pages/MoviesPage'
import MovieDetailsPage from './pages/MovieDetailsPage'
import ShowSelectionPage from './pages/ShowSelectionPage'
import SeatSelectionPage from './pages/SeatSelectionPage'
import CheckoutPage from './pages/CheckoutPage'
import PaymentResultPage from './pages/PaymentResultPage'
import BookerProfilePage from './pages/BookerProfilePage'
import MyBookingsPage from './pages/MyBookingsPage'
import BookingDetailsPage from './pages/BookingDetailsPage'
import NotificationsPage from './pages/NotificationsPage'
import NotFoundPage from './pages/NotFoundPage'
import {
  fetchBookerMovieDetail,
  fetchBookerMovies,
  fetchBookerShowDiscovery,
} from './services/booker'
import {
  createBookingCheckout,
  fetchBookingStatus,
  fetchBookingSummary,
  fetchSandboxPaymentHelpers,
  fetchShowSeatLayout,
  lockShowSeats,
  releaseShowSeatLocks,
  retryBookingPayment,
  verifyBookingPayment,
} from './services/bookings'

import './App.css'

function AuthLayout({ children }) {
  return <div className="auth-layout">{children}</div>
}

function BookerLayout() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const flow = useBookingFlow()

  useEffect(() => { if (token) flow.loadFilters() }, [token, flow.loadFilters])
  useEffect(() => { if (token) flow.refreshUnreadCount() }, [token, location.pathname, flow.refreshUnreadCount])
  useEffect(() => {
    if (location.pathname === '/') flow.loadHome()
  }, [location.pathname, flow.loadHome, flow.city])

  const handleSearchSubmit = () => {
    const term = flow.searchInput.trim()
    flow.setMovieSearch(term)
    navigate(`/movies${term ? `?search=${encodeURIComponent(term)}` : ''}`)
  }

  const handleCityChange = (nextCity) => {
    flow.setCity(nextCity)
    flow.setSelectedShow(null)
    flow.resetSeatContext()
  }

  return (
    <div className="booker-app">
      <Navbar
        user={user}
        onLogout={logout}
        searchValue={flow.searchInput}
        onSearchChange={flow.setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        city={flow.city}
        cities={flow.filtersMeta.cities || []}
        onCityChange={handleCityChange}
        unreadCount={flow.unreadCount}
      />
      <main className="booker-main">
        <Outlet />
      </main>
    </div>
  )
}

function HomeRoute() {
  const navigate = useNavigate()
  const flow = useBookingFlow()

  return (
    <BookerHomePage
      data={flow.homeData}
      loading={flow.homeLoading}
      error={flow.homeError}
      onRetry={flow.loadHome}
      onViewDetails={(movie) => {
        if (!movie?.movie_id) return
        flow.setSelectedMovie(movie)
        navigate(`/movies/${movie.movie_id}`)
      }}
      onBook={(movie) => {
        if (!movie?.movie_id) return
        flow.beginBookingForMovie(movie)
        navigate(`/movies/${movie.movie_id}/shows`)
      }}
    />
  )
}

function MoviesRoute() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const flow = useBookingFlow()
  const [searchParams] = useSearchParams()
  const urlSearch = searchParams.get('search') || ''
  const moviesFetcher = useCallback((params) => fetchBookerMovies(params, token), [token])

  useEffect(() => {
    if (urlSearch !== flow.movieSearch) {
      flow.setMovieSearch(urlSearch)
      flow.setSearchInput(urlSearch)
    }
  }, [urlSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MoviesPage
      key={`${flow.city}|${flow.movieSearch}`}
      initialSearch={flow.movieSearch}
      city={flow.city}
      filterOptions={flow.filtersMeta}
      fetchMovies={moviesFetcher}
      onViewDetails={(movie) => {
        if (!movie?.movie_id) return
        flow.setSelectedMovie(movie)
        navigate(`/movies/${movie.movie_id}`)
      }}
      onBook={(movie) => {
        if (!movie?.movie_id) return
        flow.beginBookingForMovie(movie)
        navigate(`/movies/${movie.movie_id}/shows`)
      }}
    />
  )
}

function MovieDetailsRoute() {
  const { token } = useAuth()
  const { movieId } = useParams()
  const navigate = useNavigate()
  const flow = useBookingFlow()
  const detailFetcher = useCallback((id) => fetchBookerMovieDetail(id, token), [token])

  return (
    <MovieDetailsPage
      movieId={movieId}
      fetchDetail={detailFetcher}
      onBack={() => navigate('/movies')}
      onBook={(movie) => {
        const m = movie?.movie_id ? movie : (flow.selectedMovie?.movie_id === movieId ? flow.selectedMovie : { movie_id: movieId, movie_name: movie?.movie_name || 'Movie' })
        const movieToUse = m?.movie_id ? m : { movie_id: movieId, ...(movie && typeof movie === 'object' ? movie : {}) }
        if (movieToUse?.movie_id) flow.setSelectedMovie(movieToUse)
        flow.beginBookingForMovie(movieToUse)
        navigate(`/movies/${movieToUse.movie_id || movieId}/shows`)
      }}
    />
  )
}

function ShowSelectionRoute() {
  const { token } = useAuth()
  const { movieId } = useParams()
  const navigate = useNavigate()
  const flow = useBookingFlow()
  const showDiscoveryFetcher = useCallback((id, params) => fetchBookerShowDiscovery(id, params, token), [token])

  const handleDateChange = (nextDate, opts = {}) => {
    flow.setSelectedDate(nextDate || '')
    if (!opts.syncOnly) {
      flow.setSelectedShow(null)
      flow.resetSeatContext()
    }
  }

  const handleShowSelect = (show) => {
    const prevId = flow.selectedShow?.show_id
    flow.setSelectedShow(show)
    if (!show || show.show_id !== prevId) {
      flow.resetSeatContext()
      flow.seatContextShowIdRef.current = show?.show_id || null
      flow.resetPaymentContext()
    }
  }

  const handleContinueToSeats = (show, movie) => {
    if (show) flow.setSelectedShow(show)
    if (movie) flow.setSelectedMovie((prev) => ({ ...(prev || {}), ...movie }))
    const showId = (show || flow.selectedShow)?.show_id
    if (!showId) return
    if (flow.seatContextShowIdRef.current !== showId) {
      flow.resetSeatContext()
      flow.seatContextShowIdRef.current = showId
    }
    navigate(`/shows/${showId}/seats`)
  }

  return (
    <ShowSelectionPage
      movieId={movieId}
      city={flow.city}
      selectedDate={flow.selectedDate}
      selectedShow={flow.selectedShow}
      fetchDiscovery={showDiscoveryFetcher}
      onBackToDetails={() => navigate(`/movies/${movieId}`)}
      onDateChange={handleDateChange}
      onShowSelect={handleShowSelect}
      onContinueToSeats={handleContinueToSeats}
    />
  )
}

function SeatSelectionRoute() {
  const { token } = useAuth()
  const { showId } = useParams()
  const navigate = useNavigate()
  const flow = useBookingFlow()

  const loadSeatLayout = useCallback(async (sid, opts = {}) => {
    if (!sid) return
    flow.setSeatLoading(true)
    flow.setSeatError('')
    if (!opts.silent) flow.setLockError('')
    try {
      const data = await fetchShowSeatLayout(sid, token)
      flow.setSeatLayout(data)
      flow.setSelectedSeatIds((prev) => prev.filter((id) => {
        const seat = (data.seats || []).find((s) => s.seat_id === id)
        return seat && seat.availability_status === 'AVAILABLE' && seat.is_active
      }))
      // enrich selectedShow/movie context if missing
      if (data?.show && !flow.selectedShow) {
        flow.setSelectedShow((prev) => prev || { show_id: data.show.show_id, start_time: data.show.start_time, end_time: data.show.end_time, show_date: data.show.show_date, screen_name: data.show.screen_name, screen_number: data.show.screen_number, theatre_name: data.show.theatre_name, theatre_id: data.show.theatre_id, screen_id: data.show.screen_id })
      }
      return data
    } catch (err) {
      flow.setSeatError(err.message || 'Failed to load seat layout')
      return null
    } finally {
      flow.setSeatLoading(false)
    }
  }, [token, flow])

  useEffect(() => { if (showId) loadSeatLayout(showId) }, [showId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleSeat = (seat, { maxSeats = 10 } = {}) => {
    if (!seat) return
    flow.setLockError('')
    flow.setSelectedSeatIds((prev) => {
      const exists = prev.includes(seat.seat_id)
      if (exists) return prev.filter((id) => id !== seat.seat_id)
      if (prev.length >= maxSeats) {
        flow.setLockError(`You can select up to ${maxSeats} seats.`)
        return prev
      }
      return [...prev, seat.seat_id]
    })
  }

  const handleProceedToLock = async () => {
    if (!showId || !flow.selectedSeatIds.length) return
    if (flow.lockInfo) return
    flow.setLocking(true)
    flow.setLockError('')
    try {
      const res = await lockShowSeats(showId, flow.selectedSeatIds, token)
      flow.setLockInfo(res)
      flow.setSelectedSeatIds((res.seats || []).map((s) => s.seat_id))
      await loadSeatLayout(showId, { silent: true })
    } catch (err) {
      flow.setLockError(err.message || 'Failed to lock selected seats')
      await loadSeatLayout(showId, { silent: true })
    } finally {
      flow.setLocking(false)
    }
  }

  const handleReleaseLock = async (opts = {}) => {
    if (!showId) return
    const payload = flow.lockInfo?.lock_token ? { lock_token: flow.lockInfo.lock_token } : {}
    flow.setLocking(true)
    flow.setLockError('')
    try {
      if (flow.lockInfo?.lock_token || flow.lockInfo) {
        await releaseShowSeatLocks(showId, payload, token)
      }
    } catch (err) {
      if (!opts.silent) flow.setLockError(err.message || 'Failed to release seat lock')
    } finally {
      flow.setLockInfo(null)
      flow.setSelectedSeatIds([])
      flow.setLocking(false)
      await loadSeatLayout(showId, { silent: true })
    }
  }

  const handleLockExpired = async () => {
    flow.setLockInfo(null)
    flow.setLockError('Your seat lock has expired. Please select seats again.')
    await loadSeatLayout(showId, { silent: true })
  }

  const showForPage = flow.selectedShow?.show_id === showId ? flow.selectedShow : (flow.seatLayout?.show ? { show_id: showId, ...flow.seatLayout.show } : { show_id: showId })

  if (!showId) return <Navigate to="/movies" replace />

  return (
    <SeatSelectionPage
      movie={flow.selectedMovie}
      show={showForPage}
      seatLayout={flow.seatLayout}
      selectedSeatIds={flow.selectedSeatIds}
      lockInfo={flow.lockInfo}
      loading={flow.seatLoading}
      error={flow.seatError}
      lockError={flow.lockError}
      locking={flow.locking}
      onBackToShows={() => {
        if (flow.selectedMovie?.movie_id) navigate(`/movies/${flow.selectedMovie.movie_id}/shows`)
        else navigate('/movies')
      }}
      onRefresh={() => loadSeatLayout(showId)}
      onToggleSeat={handleToggleSeat}
      onClearSelection={() => { flow.setSelectedSeatIds([]); flow.setLockError('') }}
      onProceedToLock={handleProceedToLock}
      onReleaseLock={() => handleReleaseLock()}
      onLockExpired={handleLockExpired}
      onContinueToCheckout={() => navigate('/checkout')}
    />
  )
}

function CheckoutRoute() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const flow = useBookingFlow()
  const summaryFetcher = useCallback((lockToken) => fetchBookingSummary(lockToken, token), [token])
  const checkoutCreator = useCallback((lockToken) => createBookingCheckout(lockToken, token), [token])
  const paymentVerifier = useCallback((bookingId, payload) => verifyBookingPayment(bookingId, payload, token), [token])
  const sandboxHelpersFetcher = useCallback((bookingId) => fetchSandboxPaymentHelpers(bookingId, token), [token])
  const bookingStatusFetcher = useCallback((bookingId) => fetchBookingStatus(bookingId, token), [token])

  const lockToken = flow.lockInfo?.lock_token
  const showId = flow.selectedShow?.show_id || flow.seatLayout?.show?.show_id

  if (!lockToken) {
    if (showId) return <Navigate to={`/shows/${showId}/seats`} replace />
    return <Navigate to="/movies" replace />
  }

  const handlePaymentResult = async (resultFlow) => {
    flow.setPaymentFlow(resultFlow)
    if (resultFlow?.bookingId) {
      try {
        const st = await bookingStatusFetcher(resultFlow.bookingId)
        flow.setPaymentBookingStatus(st)
      } catch {
        flow.setPaymentBookingStatus(null)
      }
    }
    navigate('/payment-result')
  }

  return (
    <CheckoutPage
      lockToken={lockToken}
      movie={flow.selectedMovie}
      show={flow.selectedShow || flow.seatLayout?.show}
      fetchSummary={summaryFetcher}
      createCheckout={checkoutCreator}
      verifyPayment={paymentVerifier}
      fetchSandboxHelpers={sandboxHelpersFetcher}
      onBackToSeats={() => showId ? navigate(`/shows/${showId}/seats`) : navigate('/movies')}
      onPaymentResult={handlePaymentResult}
    />
  )
}

function PaymentResultRoute() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const flow = useBookingFlow()
  const bookingStatusFetcher = useCallback((bookingId) => fetchBookingStatus(bookingId, token), [token])

  const pf = flow.paymentFlow
  const hasResult = pf && (pf.status || pf.bookingId || pf.result)
  if (!hasResult) {
    return <Navigate to="/bookings" replace />
  }

  const handleRetryPayment = async (bookingId) => {
    flow.setPaymentRetrying(true)
    try {
      await retryBookingPayment(bookingId, token)
      const st = await bookingStatusFetcher(bookingId)
      flow.setPaymentBookingStatus(st)
      flow.setPaymentFlow({ status: 'retry', bookingId, result: null, message: '' })
      navigate('/checkout')
    } catch (err) {
      flow.setPaymentFlow({ status: 'failed', bookingId, result: null, message: err.message || 'Retry failed' })
      try { flow.setPaymentBookingStatus(await bookingStatusFetcher(bookingId)) } catch { /* ignore */ }
      navigate('/payment-result')
    } finally {
      flow.setPaymentRetrying(false)
    }
  }

  return (
    <PaymentResultPage
      status={pf.status === 'success' ? 'success' : 'failed'}
      bookingStatus={flow.paymentBookingStatus}
      paymentResult={pf}
      onRetry={handleRetryPayment}
      onGoHome={() => navigate('/')}
      onViewBookings={() => navigate('/bookings')}
      onViewTicket={(bookingId) => { if (bookingId) navigate(`/bookings/${bookingId}`) }}
      retrying={flow.paymentRetrying}
    />
  )
}

function BookingsRoute() {
  const navigate = useNavigate()
  return <MyBookingsPage onViewBooking={(bookingId) => navigate(`/bookings/${bookingId}`)} />
}

function BookingDetailsRoute() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  return <BookingDetailsPage bookingId={bookingId} onBack={() => navigate('/bookings')} />
}

function NotificationsRoute() {
  const flow = useBookingFlow()
  return <NotificationsPage onUnreadChange={flow.setUnreadCount} />
}

function ProfileRoute() {
  const { logout } = useAuth()
  return <BookerProfilePage onLogout={logout} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/signup" element={<AuthLayout><SignupPage /></AuthLayout>} />
      </Route>

      <Route element={<RequireBooker />}>
        <Route element={<BookingFlowProvider><BookerLayout /></BookingFlowProvider>}>
          <Route index element={<HomeRoute />} />
          <Route path="/movies" element={<MoviesRoute />} />
          <Route path="/movies/:movieId" element={<MovieDetailsRoute />} />
          <Route path="/movies/:movieId/shows" element={<ShowSelectionRoute />} />
          <Route path="/shows/:showId/seats" element={<SeatSelectionRoute />} />
          <Route path="/checkout" element={<CheckoutRoute />} />
          <Route path="/payment-result" element={<PaymentResultRoute />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="/bookings" element={<BookingsRoute />} />
          <Route path="/bookings/:bookingId" element={<BookingDetailsRoute />} />
          <Route path="/notifications" element={<NotificationsRoute />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider kind="booker">
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
