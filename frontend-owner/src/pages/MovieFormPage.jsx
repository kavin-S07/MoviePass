import { useEffect, useRef, useState } from 'react'

import MovieBrowserPanel from '../components/MovieBrowserPanel'
import { useAuth } from '../context/AuthContext'
import { createMovie, fetchMovie, fetchMovieByName, updateMovie } from '../services/movies'
import { mapMovieToTheatre } from '../services/theatres'

const EMPTY_FORM = {
  movie_name: '',
  poster_url: '',
  release_date: '',
  duration_minutes: '',
  language: '',
  genre: '',
  certification: '',
  director_name: '',
  cast_names: '',
  description: '',
}

function normalizeForm(movie) {
  return {
    movie_name: movie.movie_name || '',
    poster_url: movie.poster_url || '',
    release_date: movie.release_date || '',
    duration_minutes: movie.duration_minutes ?? '',
    language: movie.language || '',
    genre: movie.genre || '',
    certification: movie.certification || '',
    director_name: movie.director_name || '',
    cast_names: movie.cast_names || '',
    description: movie.description || '',
  }
}

export default function MovieFormPage({ movieId = null, onDone }) {
  const { token } = useAuth()
  const isEdit = Boolean(movieId)

  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)

  // Existing-movie reuse flow (Add Movie mode)
  const [existingMovie, setExistingMovie] = useState(null)
  const [checkState, setCheckState] = useState('idle') // idle | checking | exists
  const [checkError, setCheckError] = useState('')

  // "Show Movies" flow (Add Movie mode): browse the catalogue and pick a movie
  // to pre-fill the form. sourceMovie is the catalogue movie the form is based on.
  const [showBrowser, setShowBrowser] = useState(false)
  const [sourceMovie, setSourceMovie] = useState(null)
  const formRef = useRef(null)

  useEffect(() => {
    if (!isEdit) return

    let cancelled = false
    setLoading(true)
    fetchMovie(movieId, token)
      .then((movie) => {
        if (!cancelled) setForm(normalizeForm(movie))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load movie')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [isEdit, movieId, token])

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function selectMovie(movie) {
    // Don't silently discard what the owner already typed.
    const baseline = sourceMovie ? normalizeForm(sourceMovie) : EMPTY_FORM
    const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
    if (dirty && !window.confirm('Replace the details you have entered with the selected movie?')) return

    setForm(normalizeForm(movie))
    setSourceMovie(movie)
    setShowBrowser(false)
    setError('')
    setCheckError('')
    setMessage('')
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function clearSelection() {
    setSourceMovie(null)
    setForm(EMPTY_FORM)
    setError('')
    setMessage('')
  }

  function validate() {
    if (!form.movie_name.trim()) return 'Movie name is required'
    if (form.movie_name.trim().length > 200) return 'Movie name must be 200 characters or less'
    if (form.poster_url && form.poster_url.length > 500) return 'Poster URL must be 500 characters or less'
    if (form.duration_minutes !== '') {
      const n = Number(form.duration_minutes)
      if (!Number.isInteger(n) || n < 1 || n > 1000) return 'Duration must be a whole number between 1 and 1000'
    }
    if (form.certification && form.certification.length > 10) return 'Certification must be 10 characters or less'
    return ''
  }

  // Checks whether a movie with the same name already exists, then either
  // shows the "Movie Already Exists!" confirmation modal or creates a new movie.
  async function checkAndCreate() {
    setCheckState('checking')
    setExistingMovie(null)
    setCheckError('')
    let found = null
    try {
      const res = await fetchMovieByName(form.movie_name.trim(), token)
      if (res && res.movie_id) found = res
    } catch (err) {
      if (err?.status !== 404) setCheckError(err.message || 'Could not check if the movie already exists')
    }
    if (found) {
      setExistingMovie(found)
      setCheckState('exists')
      return
    }
    setCheckState('idle')
    await saveMovie()
  }

  async function saveMovie() {
    const payload = {
      movie_name: form.movie_name.trim(),
      poster_url: form.poster_url.trim() || null,
      release_date: form.release_date || null,
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      language: form.language.trim() || null,
      genre: form.genre.trim() || null,
      certification: form.certification.trim() || null,
      director_name: form.director_name.trim() || null,
      cast_names: form.cast_names.trim() || null,
      description: form.description.trim() || null,
    }

    setSubmitting(true)
    setError('')
    try {
      if (isEdit) {
        await updateMovie(movieId, payload, token)
        onDone({ saved: true, message: 'Movie saved successfully.' })
      } else {
        // The server maps the movie to the owner's theatre in the same
        // transaction. With a selected catalogue movie it reuses that record if
        // nothing changed, otherwise it creates a separate copy for this theatre.
        const created = await createMovie(
          sourceMovie ? { ...payload, source_movie_id: sourceMovie.movie_id } : payload,
          token,
        )
        const name = created?.movie_name || payload.movie_name
        const text = created?.reused_existing
          ? `"${name}" was added to your theatre.`
          : sourceMovie
            ? `Your edited version of "${name}" was created and added to your theatre.`
            : `"${name}" was created and added to your theatre.`
        setMessage(text)
        onDone({ saved: true, message: text })
      }
    } catch (err) {
      setError(err.message || 'Could not save movie')
    } finally {
      setSubmitting(false)
    }
  }

  async function continueWithExisting() {
    // Reuse the existing movie: no duplicate record is created; we create
    // the theatre_movies mapping for the owner's theatre, then load the
    // existing details so the owner can schedule shows on their theatre.
    const found = existingMovie
    setExistingMovie(null)
    setCheckState('idle')
    setCheckError('')
    try {
      await mapMovieToTheatre(found?.movie_id, token)
    } catch (err) {
      setError(err.message || 'Could not map the movie to your theatre')
      return
    }
    setMessage(`Found existing movie #${found?.movie_id}. Loaded its details — you can now schedule shows on your theatre.`)
    setForm(normalizeForm(found))
    setSourceMovie(found)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCheckError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    if (submitting || checkState === 'checking') return
    if (!isEdit) {
      // A movie picked from "Show Movies" is already known: skip the by-name
      // duplicate check (an edited copy legitimately shares its name).
      if (sourceMovie) await saveMovie()
      else await checkAndCreate()
    } else {
      await saveMovie()
    }
  }

  if (loading) {
    return <div className="dash-loading">Loading movie...</div>
  }

  if (isEdit && error && !form.movie_name) {
    return (
      <div className="dash-error">
        <p>{error}</p>
        <button className="btn-secondary" onClick={() => onDone({ saved: false })}>Back to Movies</button>
      </div>
    )
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>{isEdit ? 'Edit Movie' : 'Add Movie'}</h1>
          <p>{isEdit ? 'Update movie details used for scheduling shows.' : 'Add complete movie details to schedule and manage shows.'}</p>
        </div>
        {!isEdit && (
          <div className="dash-quick">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowBrowser((v) => !v)}
              aria-expanded={showBrowser}
              disabled={submitting}
            >
              {showBrowser ? 'Hide Movies' : 'Show Movies'}
            </button>
          </div>
        )}
      </header>

      {!isEdit && showBrowser && (
        <MovieBrowserPanel
          selectedId={sourceMovie?.movie_id ?? null}
          onSelect={selectMovie}
          onClose={() => setShowBrowser(false)}
        />
      )}

      <form ref={formRef} className="panel form-grid" onSubmit={handleSubmit}>
        {!isEdit && sourceMovie && (
          <div className="form-field-full movie-source-banner" role="status">
            <p>
              <strong>Based on existing movie: {sourceMovie.movie_name}</strong>
              <span>Submit as-is to add it to your theatre, or edit any field to create your own version for your theatre only. The original is never changed.</span>
            </p>
            <button type="button" className="btn-small" onClick={clearSelection} disabled={submitting}>Clear</button>
          </div>
        )}

        <label className="form-field">
          <span>Movie Name<em> *</em></span>
          <input name="movie_name" type="text" placeholder="Movie title" value={form.movie_name} onChange={change} />
        </label>

        <label className="form-field">
          <span>Poster URL</span>
          <input name="poster_url" type="url" placeholder="https://example.com/poster.jpg" value={form.poster_url} onChange={change} />
        </label>

        <label className="form-field">
          <span>Release Date</span>
          <input name="release_date" type="date" value={form.release_date} onChange={change} />
        </label>

        <label className="form-field">
          <span>Duration (minutes)</span>
          <input name="duration_minutes" type="number" min="1" max="1000" placeholder="120" value={form.duration_minutes} onChange={change} />
        </label>

        <label className="form-field">
          <span>Language</span>
          <input name="language" type="text" placeholder="Tamil" value={form.language} onChange={change} />
        </label>

        <label className="form-field">
          <span>Genre</span>
          <input name="genre" type="text" placeholder="Action, Drama" value={form.genre} onChange={change} />
        </label>

        <label className="form-field">
          <span>Certification</span>
          <input name="certification" type="text" placeholder="U / UA / A" value={form.certification} onChange={change} />
        </label>

        <label className="form-field">
          <span>Director Name</span>
          <input name="director_name" type="text" placeholder="Director name" value={form.director_name} onChange={change} />
        </label>

        <label className="form-field form-field-full">
          <span>Cast (comma-separated names)</span>
          <textarea name="cast_names" rows={3} placeholder="Actor 1, Actor 2, Actor 3" value={form.cast_names} onChange={change} />
        </label>

        <label className="form-field form-field-full">
          <span>Description / Synopsis</span>
          <textarea name="description" rows={5} placeholder="Brief synopsis..." value={form.description} onChange={change} />
        </label>

        {form.poster_url && (
          <div className="form-field form-field-full">
            <span style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500 }}>Poster Preview</span>
            <img
              src={form.poster_url}
              alt="Poster preview"
              style={{ width: '8.75rem', height: '13.125rem', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #E7E5F0', background: '#F7F7F7' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
        )}

        {error && <p className="error form-error">{error}</p>}
        {message && !isEdit && <p className="success form-error movie-form-msg">{message}</p>}
        {checkError && <p className="error form-error">{checkError}</p>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => onDone({ saved: false })} disabled={submitting || checkState === 'checking'}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || checkState === 'checking'}>
            {submitting ? 'Saving...' : checkState === 'checking' ? 'Checking...' : (isEdit ? 'Save Changes' : 'Create Movie')}
          </button>
        </div>
      </form>

      {existingMovie && (
        <div
          className="scr-overlay"
          style={{ zIndex: 120 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setExistingMovie(null) }}
        >
          <div className="scr-modal movie-exists-modal" role="dialog" aria-modal="true" aria-labelledby="movie-exists-title">
            <div className="scr-modal-head">
              <div>
                <h2 id="movie-exists-title">Movie Already Exists!</h2>
                <p>This movie is already available in MoviePass. Do you want to add this movie to your theatre?</p>
              </div>
            </div>
            <div className="movie-exists-details">
              <div className="movie-exists-poster-wrap">
                {existingMovie.poster_url ? (
                  <img src={existingMovie.poster_url} alt={existingMovie.movie_name} className="movie-exists-poster" loading="lazy" />
                ) : (
                  <div className="movie-exists-poster-placeholder">No Poster</div>
                )}
              </div>
              <div>
                <h3 className="movie-exists-name">{existingMovie.movie_name}</h3>
                <p className="movie-exists-meta">
                  {[existingMovie.language, existingMovie.certification, existingMovie.duration_minutes ? `${existingMovie.duration_minutes} min` : null, existingMovie.release_date]
                    .filter(Boolean).join(' • ') || 'No additional details available'}
                </p>
              </div>
            </div>
            <div className="movie-exists-actions">
              <button type="button" className="btn-secondary" onClick={() => setExistingMovie(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={continueWithExisting}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
