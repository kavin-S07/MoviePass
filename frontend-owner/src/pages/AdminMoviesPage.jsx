import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAdminMovies } from '../services/admin'
import { createMovie, deleteMovie, updateMovie } from '../services/movies'

const emptyForm = { movie_name: '', poster_url: '', release_date: '', director_name: '', description: '', duration_minutes: '', language: '', genre: '', certification: '', cast_names: '' }

function normalizePayload(form) {
  return {
    movie_name: form.movie_name,
    poster_url: form.poster_url || null,
    release_date: form.release_date || null,
    director_name: form.director_name || null,
    description: form.description || null,
    duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    language: form.language || null,
    genre: form.genre || null,
    certification: form.certification || null,
    cast_names: form.cast_names || null,
  }
}

export default function AdminMoviesPage() {
  const { token } = useAuth()
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load(p = page) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminMovies({ q, page: p, page_size: 10 }, token)
      setData(res)
    } catch (err) {
      setError(err.message || 'Could not load movies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1); setPage(1) }, [token])

  function startEdit(movie) {
    setEditingId(movie.movie_id)
    setForm({
      movie_name: movie.movie_name || '',
      poster_url: movie.poster_url || '',
      release_date: movie.release_date || '',
      director_name: movie.director_name || '',
      description: movie.description || '',
      duration_minutes: movie.duration_minutes ?? '',
      language: movie.language || '',
      genre: movie.genre || '',
      certification: movie.certification || '',
      cast_names: movie.cast_names || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = normalizePayload(form)
      if (!payload.movie_name) throw new Error('Movie name is required')
      if (editingId) {
        await updateMovie(editingId, payload, token)
        setMessage('Movie updated successfully')
      } else {
        await createMovie(payload, token)
        setMessage('Movie created successfully')
      }
      resetForm()
      await load(1)
      setPage(1)
    } catch (err) {
      setError(err.message || 'Could not save movie')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id) {
    if (!window.confirm('Delete this movie? This will fail if it is referenced by existing shows.')) return
    setError('')
    setMessage('')
    try {
      await deleteMovie(id, token)
      setMessage('Movie deleted successfully')
      await load(page)
    } catch (err) {
      setError(err.message || 'Could not delete movie')
    }
  }

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 10)))

  return (
    <div className="dash">
      <header className="dash-header">
        <div><h1>Movies</h1><p>Manage the platform movie catalogue (admin/global).</p></div>
      </header>

      {message && <div className="inline-success">{message}</div>}
      {error && <div className="inline-error">{error}</div>}

      <section className="panel">
        <h2>{editingId ? `Edit Movie #${editingId}` : 'Add Movie'}</h2>
        <form className="admin-form-grid" onSubmit={onSubmit}>
          <input placeholder="Movie name *" value={form.movie_name} onChange={(e) => setForm({ ...form, movie_name: e.target.value })} required />
          <input placeholder="Poster URL" value={form.poster_url} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} />
          <input type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
          <input placeholder="Director" value={form.director_name} onChange={(e) => setForm({ ...form, director_name: e.target.value })} />
          <input type="number" min="1" placeholder="Duration (minutes)" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          <input placeholder="Language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
          <input placeholder="Genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
          <input placeholder="Certification" value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} />
          <input className="span-2" placeholder="Cast names (comma separated)" value={form.cast_names} onChange={(e) => setForm({ ...form, cast_names: e.target.value })} />
          <textarea className="span-2" rows="3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="form-actions span-2">
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Movie' : 'Create Movie'}</button>
            {editingId && <button className="btn-secondary" type="button" onClick={resetForm}>Cancel Edit</button>}
          </div>
        </form>
      </section>

      <section className="panel">
        <form className="filters-row" onSubmit={(e) => { e.preventDefault(); setPage(1); load(1) }}>
          <input placeholder="Search by name, language, genre" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-primary" type="submit">Search</button>
        </form>
        {loading ? <div className="dash-loading">Loading movies...</div> : data.items.length === 0 ? <div className="empty-state"><p>No movies found.</p></div> : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Genre</th><th>Language</th><th>Duration</th><th>Release</th><th>Actions</th></tr></thead>
                <tbody>
                  {data.items.map((m) => (
                    <tr key={m.movie_id}>
                      <td>#{m.movie_id}</td>
                      <td><strong>{m.movie_name}</strong><div className="muted small-text">{m.certification || ''}</div></td>
                      <td>{m.genre || '-'}</td>
                      <td>{m.language || '-'}</td>
                      <td>{m.duration_minutes ? `${m.duration_minutes} min` : '-'}</td>
                      <td>{m.release_date || '-'}</td>
                      <td><div className="table-actions"><button className="btn-small" onClick={() => startEdit(m)}>Edit</button><button className="btn-small danger" onClick={() => onDelete(m.movie_id)}>Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span className="muted">Total: {data.total} • Page {data.page} of {totalPages}</span>
              <div className="table-actions">
                <button className="btn-small" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}>Prev</button>
                <button className="btn-small" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(p) }}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
