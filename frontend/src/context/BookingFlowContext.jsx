import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { fetchBookerHome, fetchBookerMovieFilters } from '../services/booker'
import { fetchUnreadCount } from '../services/notifications'

const BookingFlowContext = createContext(null)

export function useBookingFlow() {
  return useContext(BookingFlowContext)
}

export function BookingFlowProvider({ children }) {
  const { token } = useAuth()
  const [city, setCity] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [movieSearch, setMovieSearch] = useState('')
  const [filtersMeta, setFiltersMeta] = useState({ languages: [], genres: [], certifications: [], cities: [] })
  const [homeData, setHomeData] = useState(null)
  const [homeLoading, setHomeLoading] = useState(false)
  const [homeError, setHomeError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  // booking flow (in-memory, non-sensitive persistence only by staying mounted during SPA nav)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedShow, setSelectedShow] = useState(null)
  const [seatLayout, setSeatLayout] = useState(null)
  const [seatLoading, setSeatLoading] = useState(false)
  const [seatError, setSeatError] = useState('')
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
  const [lockInfo, setLockInfo] = useState(null)
  const [lockError, setLockError] = useState('')
  const [locking, setLocking] = useState(false)
  const [paymentFlow, setPaymentFlow] = useState({ status: null, bookingId: null, result: null, message: '' })
  const [paymentBookingStatus, setPaymentBookingStatus] = useState(null)
  const [paymentRetrying, setPaymentRetrying] = useState(false)
  const seatContextShowIdRef = useRef(null)

  const loadHome = useCallback(async () => {
    if (!token) return
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

  const loadFilters = useCallback(async () => {
    if (!token) return
    try {
      const data = await fetchBookerMovieFilters(token)
      setFiltersMeta((prev) => ({ ...prev, ...data }))
    } catch {
      // ignore
    }
  }, [token])

  const refreshUnreadCount = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetchUnreadCount(token)
      setUnreadCount(res.unread_count || 0)
    } catch {
      // ignore
    }
  }, [token])

  const resetSeatContext = useCallback(() => {
    setSelectedSeatIds([])
    setLockInfo(null)
    setSeatLayout(null)
    setSeatError('')
    setLockError('')
    seatContextShowIdRef.current = null
  }, [])

  const resetPaymentContext = useCallback(() => {
    setPaymentFlow({ status: null, bookingId: null, result: null, message: '' })
    setPaymentBookingStatus(null)
  }, [])

  const beginBookingForMovie = useCallback((movie) => {
    if (movie) setSelectedMovie(movie)
    setSelectedShow(null)
    resetSeatContext()
    resetPaymentContext()
  }, [resetPaymentContext, resetSeatContext])

  const value = useMemo(() => ({
    city, setCity,
    searchInput, setSearchInput,
    movieSearch, setMovieSearch,
    filtersMeta, setFiltersMeta,
    homeData, homeLoading, homeError, loadHome, loadFilters,
    unreadCount, setUnreadCount, refreshUnreadCount,
    selectedMovie, setSelectedMovie,
    selectedDate, setSelectedDate,
    selectedShow, setSelectedShow,
    seatLayout, setSeatLayout,
    seatLoading, setSeatLoading,
    seatError, setSeatError,
    selectedSeatIds, setSelectedSeatIds,
    lockInfo, setLockInfo,
    lockError, setLockError,
    locking, setLocking,
    paymentFlow, setPaymentFlow,
    paymentBookingStatus, setPaymentBookingStatus,
    paymentRetrying, setPaymentRetrying,
    seatContextShowIdRef,
    resetSeatContext, resetPaymentContext, beginBookingForMovie,
  }), [city, searchInput, movieSearch, filtersMeta, homeData, homeLoading, homeError, loadHome, loadFilters, unreadCount, refreshUnreadCount, selectedMovie, selectedDate, selectedShow, seatLayout, seatLoading, seatError, selectedSeatIds, lockInfo, lockError, locking, paymentFlow, paymentBookingStatus, paymentRetrying, resetSeatContext, resetPaymentContext, beginBookingForMovie])

  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>
}
