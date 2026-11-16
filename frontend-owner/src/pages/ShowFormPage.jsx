import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { fetchMovies } from '../services/movies'
import { fetchScreens } from '../services/screens'
import { createShow } from '../services/shows'
import { fetchTheatres } from '../services/theatres'

export default function ShowFormPage({ onDone }) {
  const { token } = useAuth()

  const [movies, setMovies] = useState([])
  const [theatres, setTheatres] = useState([])
  const [screens, setScreens] = useState([])
  const [loading, setLoading] = useState(true)
  const [screensLoading, setScreensLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    movie_id: '',
    theatre_id: '',
    screen_id: '',
    show_date: '',
    start_time: '',
    end_time: '',
    status: 'Scheduled',
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchMovies(token), fetchTheatres(token)])
      .then(([moviesData, theatresData]) => {
        if (cancelled) return
        setMovies(moviesData)
        setTheatres(theatresData)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load movies/theatres')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!form.theatre_id) {
      setScreens([])
      setForm((prev) => ({ ...prev, screen_id: '' }))
      return
    }

    let cancelled = false
    setScreensLoading(true)
    setError('')
    fetchScreens(form.theatre_id, token)
      .then((data) => {
        if (cancelled) return
        setScreens(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load screens for selected theatre')
      })
      .finally(() => {
        if (!cancelled) setScreensLoading(false)
      })

    return () => { cancelled = true }
  }, [form.theatre_id, token])

  const selectedTheatreHasScreens = useMemo(() => screens.length > 0, [screens])

  function change(e) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'theatre_id' ? { screen_id: '' } : {}),
    }))
  }

  function validate() {
    if (!form.movie_id) return 'Please select a movie'
    if (!form.theatre_id) return 'Please select a theatre'
    if (!form.screen_id) return 'Please select a screen'
    if (!form.show_date) return 'Show date is required'
    if (!form.start_time) return 'Start time is required'
    if (!form.end_time) return 'End time is required'
    if (form.end_time <= form.start_time) return 'End time must be after start time'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      await createShow({
        movie_id: Number(form.movie_id),
        screen_id: Number(form.screen_id),
        show_date: form.show_date,
        start_time: form.start_time,
        end_time: form.end_time,
        status: form.status,
      }, token)
      onDone({ saved: true })
    } catch (err) {
      setError(err.message || 'Could not create show')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="dash-loading">Loading show form...</div>

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Schedule Show</h1>
          <p>Select a movie, theatre, screen, and time slot for the show.</p>
        </div>
      </header>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Movie<em> *</em></span>
          <select name="movie_id" value={form.movie_id} onChange={change}>
            <option value="">Select a movie</option>
            {movies.map((movie) => (
              <option key={movie.movie_id} value={movie.movie_id}>
                {movie.movie_name}{movie.language ? ` (${movie.language})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Theatre<em> *</em></span>
          <select name="theatre_id" value={form.theatre_id} onChange={change}>
            <option value="">Select a theatre</option>
            {theatres.map((theatre) => (
              <option key={theatre.theatre_id} value={theatre.theatre_id}>
                {theatre.name}{theatre.city ? ` - ${theatre.city}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Screen<em> *</em></span>
          <select name="screen_id" value={form.screen_id} onChange={change} disabled={!form.theatre_id || screensLoading}>
            <option value="">
              {!form.theatre_id ? 'Select a theatre first' : screensLoading ? 'Loading screens...' : 'Select a screen'}
            </option>
            {screens.map((screen) => (
              <option key={screen.screen_id} value={screen.screen_id}>
                {screen.screen_name} ({screen.no_of_rows}x{screen.no_of_columns})
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Status</span>
          <select name="status" value={form.status} onChange={change}>
            <option value="Scheduled">Scheduled</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Completed">Completed</option>
          </select>
        </label>

        <label className="form-field">
          <span>Show Date<em> *</em></span>
          <input type="date" name="show_date" value={form.show_date} onChange={change} />
        </label>

        <label className="form-field">
          <span>Start Time<em> *</em></span>
          <input type="time" name="start_time" value={form.start_time} onChange={change} />
        </label>

        <label className="form-field">
          <span>End Time<em> *</em></span>
          <input type="time" name="end_time" value={form.end_time} onChange={change} />
        </label>

        {form.theatre_id && !screensLoading && !selectedTheatreHasScreens && (
          <p className="muted form-field-full">Selected theatre has no screens. Add a screen before scheduling a show.</p>
        )}
        {movies.length === 0 && (
          <p className="muted form-field-full">No movies available. Add a movie first from the Movies page.</p>
        )}
        {theatres.length === 0 && (
          <p className="muted form-field-full">No theatres available. Add a theatre first.</p>
        )}

        {error && <p className="error form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => onDone({ saved: false })}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting || movies.length === 0 || theatres.length === 0}>
            {submitting ? 'Scheduling...' : 'Create Show'}
          </button>
        </div>
      </form>
    </div>
  )
}
