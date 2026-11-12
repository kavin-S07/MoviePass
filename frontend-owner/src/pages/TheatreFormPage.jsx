import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { createTheatre, updateTheatre, fetchTheatre } from '../services/theatres'

// Add (theatreId unset) or Edit (theatreId set) a theatre
export default function TheatreFormPage({ theatreId = null, onDone }) {

  const { token } = useAuth()

  const isEdit = Boolean(theatreId)

  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    contact_number: '',
    status: 'ACTIVE',
  })

  const [error, setError] = useState('')

  const [loading, setLoading] = useState(isEdit)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {

    if (!isEdit) return

    fetchTheatre(theatreId, token)
      .then((theatre) => {

        setForm({
          name: theatre.name || '',
          address: theatre.address || '',
          city: theatre.city || '',
          state: theatre.state || '',
          pincode: theatre.pincode || '',
          latitude: theatre.latitude ?? '',
          longitude: theatre.longitude ?? '',
          contact_number: theatre.contact_number || '',
          status: theatre.status || 'ACTIVE',
        })
      })
      .catch((err) => setError(err.message || 'Could not load theatre'))
      .finally(() => setLoading(false))

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theatreId, token, isEdit])

  function change(e) {

    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function validate() {

    if (!form.name.trim()) return 'Theatre name is required'
    if (!form.address.trim()) return 'Address is required'
    if (form.pincode && !/^[0-9]{6}$/.test(form.pincode)) return 'Pincode must be 6 digits'
    if (form.contact_number && !/^[0-9]{10}$/.test(form.contact_number)) return 'Contact number must be 10 digits'
    if (form.latitude !== '' && (isNaN(Number(form.latitude)) || Number(form.latitude) < -90 || Number(form.latitude) > 90)) return 'Latitude must be a number between -90 and 90'
    if (form.longitude !== '' && (isNaN(Number(form.longitude)) || Number(form.longitude) < -180 || Number(form.longitude) > 180)) return 'Longitude must be a number between -180 and 180'

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

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode || null,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      contact_number: form.contact_number || null,
      status: form.status,
    }

    try {

      if (isEdit) {

        await updateTheatre(theatreId, payload, token)

        onDone({ saved: 'updated', theatreId })

      } else {

        const created = await createTheatre(payload, token)

        onDone({ saved: 'created', theatreId: created.theatre_id })
      }

    } catch (err) {

      setError(err.message || 'Could not save theatre')
    } finally {

      setSubmitting(false)
    }
  }

  if (loading) {

    return <div className="dash-loading">Loading theatre...</div>
  }

  const fields = [
    ['name', 'Theatre Name', 'text', 'PVR Grand', true],
    ['address', 'Address', 'text', 'MG Road, No. 123', true],
    ['city', 'City', 'text', 'Chennai', false],
    ['state', 'State', 'text', 'Tamil Nadu', false],
    ['pincode', 'Pincode', 'text', '600001', false],
    ['contact_number', 'Contact Number', 'text', '9876543210', false],
    ['latitude', 'Latitude', 'text', '13.0827', false],
    ['longitude', 'Longitude', 'text', '80.2707', false],
  ]

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>{isEdit ? 'Edit Theatre' : 'Add New Theatre'}</h1>
          <p>
            {isEdit
              ? 'Update the details of your theatre.'
              : 'Add a new theatre to your theatre portfolio.'}
          </p>
        </div>
      </header>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        {fields.map(([name, label, type, placeholder, required]) => (
          <label key={name} className="form-field">
            <span>{label}{required && <em> *</em>}</span>
            {name === 'address' ? (
              <textarea
                name={name}
                rows={2}
                placeholder={placeholder}
                value={form[name]}
                onChange={change}
              />
            ) : (
              <input
                name={name}
                type={type}
                placeholder={placeholder}
                value={form[name]}
                onChange={change}
              />
            )}
          </label>
        ))}

        <label className="form-field">
          <span>Status</span>
          <select name="status" value={form.status} onChange={change}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>

        {error && <p className="error form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => onDone({ saved: null })}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Theatre')}
          </button>
        </div>
      </form>
    </div>
  )
}
