import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { createMovie, fetchMovie, updateMovie } from '../services/movies'

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
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

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
    try {
      if (isEdit) {
        await updateMovie(movieId, payload, token)
      } else {
        await createMovie(payload, token)
      }
      onDone({ saved: true })
    } catch (err) {
      setError(err.message || 'Could not save movie')
    } finally {
      setSubmitting(false)
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
      </header>

      <form className="panel form-grid" onSubmit={handleSubmit}>
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
            <span style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Poster Preview</span>
            <img
              src={form.poster_url}
              alt="Poster preview"
              style={{ width: 140, height: 210, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
        )}

        {error && <p className="error form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => onDone({ saved: false })}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Movie')}
          </button>
        </div>
      </form>
    </div>
  )
}
