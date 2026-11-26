import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { fetchBookerHome, fetchBookerMovieFilters } from '../services/booker'
import { fetchUnreadCount } from '../services/notifications'
import { releaseShowSeatLocks } from '../services/bookings'

const BookingFlowContext = createContext(null)

const CITY_STORAGE_KEY = 'moviepass_selected_city'

function readStoredCity() {
  try {
    return window.localStorage.getItem(CITY_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function storeCity(value) {
  try {
    window.localStorage.setItem(CITY_STORAGE_KEY, value || '')
  } catch {
    // localStorage may be unavailable (e.g., privacy mode); city still works in-memory
  }
}

export function useBookingFlow() {
  return useContext(BookingFlowContext)
}

export function BookingFlowProvider({ children }) {
  const { user } = useAuth()
  const [city, setCityState] = useState(readStoredCity)
  const setCity = useCallback((nextCity) => {
    storeCity(nextCity || '')
    setCityState(nextCity || '')
  }, [])
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
  // True while the user is on the payment (checkout) step; navigation away must be confirmed.
  const [paymentGuard, setPaymentGuard] = useState(false)
  // Mirrors of lockInfo / lock show id so reset helpers can release the server-side lock.
  const lockRef = useRef(null)
  const lockShowIdRef = useRef(null)
  lockRef.current = lockInfo

  const loadHome = useCallback(async () => {
    if (!user) return
    setHomeLoading(true)
    setHomeError('')
    try {
      const data = await fetchBookerHome(city ? { city } : {})
      setHomeData(data)
      if (data?.filters) setFiltersMeta(data.filters)
    } catch (err) {
      setHomeError(err.message || 'Failed to load dashboard')
    } finally {
      setHomeLoading(false)
    }
  }, [city, user])

  const loadFilters = useCallback(async () => {
    if (!user) return
    try {
      const data = await fetchBookerMovieFilters()
      setFiltersMeta((prev) => ({ ...prev, ...data }))
    } catch {
      // ignore
    }
  }, [user])

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetchUnreadCount()
      setUnreadCount(res.unread_count || 0)
    } catch {
      // ignore
    }
  }, [user])

  // Best-effort release of the active server-side seat lock (never throws).
  const releaseActiveLock = useCallback(async () => {
    const lock = lockRef.current
    const sid = lockShowIdRef.current
    lockRef.current = null
    lockShowIdRef.current = null
    if (!lock || !sid) return
    try {
      await releaseShowSeatLocks(sid, lock.lock_token ? { lock_token: lock.lock_token } : {})
    } catch {
      // lock may already be expired/consumed
    }
  }, [])

  const resetSeatContext = useCallback(() => {
    // Don't leave seats locked on the server when the local context is discarded.
    releaseActiveLock()
    setSelectedSeatIds([])
    setLockInfo(null)
    setSeatLayout(null)
    setSeatError('')
    setLockError('')
    seatContextShowIdRef.current = null
  }, [releaseActiveLock])

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
    paymentGuard, setPaymentGuard,
    lockShowIdRef, releaseActiveLock,
    resetSeatContext, resetPaymentContext, beginBookingForMovie,
  }), [paymentGuard, releaseActiveLock, city, searchInput, movieSearch, filtersMeta, homeData, homeLoading, homeError, loadHome, loadFilters, unreadCount, refreshUnreadCount, selectedMovie, selectedDate, selectedShow, seatLayout, seatLoading, seatError, selectedSeatIds, lockInfo, lockError, locking, paymentFlow, paymentBookingStatus, paymentRetrying, resetSeatContext, resetPaymentContext, beginBookingForMovie])

  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>
}
