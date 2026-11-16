import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, fetchSessions, logoutAll, revokeSession, updateProfile } from '../services/auth'

export default function BookerProfilePage({ onLogout }) {
  const { token, user: authUser, setUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', phone_no: '' })
  const [editing, setEditing] = useState(false)

  async function loadAll() {
    setLoading(true); setError(''); setMsg('')
    try {
      const [p, s] = await Promise.all([fetchProfile(token), fetchSessions(token)])
      setProfile(p)
      setSessions(s || [])
      setForm({ name: p?.name || '', phone_no: p?.phone_no || '' })
      if (setUser) setUser((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), ...p, user_id: p?.user_id ?? prev?.user_id }))
    } catch (e) {
      setError(e.message || 'Failed to load profile data')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line

  async function onSave(e) {
    e.preventDefault()
    setSaving(true); setError(''); setMsg('')
    try {
      const payload = {}
      if (form.name !== (profile?.name || '')) payload.name = form.name.trim()
      if ((form.phone_no || '') !== (profile?.phone_no || '')) payload.phone_no = form.phone_no.trim()
      if (Object.keys(payload).length === 0) { setMsg('No changes to save.'); setEditing(false); return }
      if (payload.phone_no && !/^[0-9]{10}$/.test(payload.phone_no)) throw new Error('Phone number must be 10 digits')
      if (payload.name && payload.name.trim().length < 2) throw new Error('Name must be at least 2 characters')
      const updated = await updateProfile(payload, token)
      setProfile(updated)
      setForm({ name: updated?.name || '', phone_no: updated?.phone_no || '' })
      setMsg('Profile updated successfully.')
      setEditing(false)
      if (setUser) setUser((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), ...updated }))
    } catch (e2) { setError(e2.message || 'Failed to update profile') }
    finally { setSaving(false) }
  }

  async function onRevoke(sessionId, isCurrent) {
    if (!window.confirm(isCurrent ? 'Revoke this current session? You may be logged out.' : 'Revoke this session?')) return
    setError(''); setMsg('')
    try {
      await revokeSession(sessionId, token)
      setMsg('Session revoked.')
      if (isCurrent) {
        await onLogout?.()
        return
      }
      await loadAll()
    } catch (e) { setError(e.message || 'Failed to revoke session') }
  }

  async function onLogoutAll() {
    if (!window.confirm('Log out from all sessions? This will sign you out everywhere.')) return
    setError(''); setMsg('')
    try {
      await logoutAll(token)
      setMsg('All sessions logged out.')
      await onLogout?.()
    } catch (e) {
      setError(e.message || 'Failed to logout from all sessions')
      await onLogout?.()
    }
  }

  if (loading && !profile) return <div className="page-state">Loading profile...</div>

  return (
    <div className="page-container profile-page">
      <div className="page-header-row">
        <div>
          <h1>Profile & Account Settings</h1>
          <p>Manage your account details and active sessions.</p>
        </div>
        <button className="btn-secondary" onClick={loadAll} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>

      {error && <div className="error-state-box inline-alert"><p>{error}</p></div>}
      {msg && <div className="info-state-box"><p>{msg}</p></div>}

      <div className="checkout-grid">
        <section className="checkout-card">
          <h2>Profile Information</h2>
          {!editing ? (
            <>
              <div className="summary-row"><span>Name</span><strong>{profile?.name || authUser?.name || 'N/A'}</strong></div>
              <div className="summary-row"><span>Email</span><strong>{profile?.email || authUser?.email || 'N/A'}</strong></div>
              <div className="summary-row"><span>Phone Number</span><strong>{profile?.phone_no || 'Not provided'}</strong></div>
              <div className="summary-row"><span>Account Role</span><strong>{profile?.role || authUser?.role || 'N/A'}</strong></div>
              <div className="summary-row"><span>Account Created</span><strong>{profile?.account_created_at ? new Date(profile.account_created_at).toLocaleString() : 'Not available'}</strong></div>
              <div className="ticket-actions no-print" style={{marginTop:12}}>
                <button className="btn-primary" onClick={() => setEditing(true)}>Edit Profile</button>
                <button className="btn-secondary" onClick={onLogout}>Logout (Current Session)</button>
              </div>
              <p className="muted-note">Role and approval status cannot be changed from this page.</p>
            </>
          ) : (
            <form onSubmit={onSave} className="profile-edit-form">
              <label>
                <span>Name</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} maxLength={100} required />
              </label>
              <label>
                <span>Email (read-only)</span>
                <input value={profile?.email || ''} disabled />
              </label>
              <label>
                <span>Phone Number (10 digits)</span>
                <input value={form.phone_no || ''} onChange={(e) => setForm({ ...form, phone_no: e.target.value.replace(/\D/g, '').slice(0,10) })} pattern="^[0-9]{10}$" placeholder="10-digit phone number" />
              </label>
              <div className="ticket-actions">
                <button className="btn-secondary" type="button" onClick={() => { setEditing(false); setForm({ name: profile?.name || '', phone_no: profile?.phone_no || '' }) }} disabled={saving}>Cancel</button>
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          )}
        </section>

        <section className="checkout-card">
          <h2>Account Actions</h2>
          <p className="muted-note">Use account settings to manage security and sessions for your MoviePass account.</p>
          <div className="ticket-actions" style={{marginTop:12, flexDirection:'column', alignItems:'stretch'}}>
            <button className="btn-secondary" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>Manage Active Sessions</button>
            <button className="btn-secondary danger-btn" onClick={onLogoutAll}>Logout from All Sessions</button>
          </div>
        </section>
      </div>

      <section className="checkout-card" style={{marginTop:16}}>
        <h2>Active Sessions</h2>
        <p className="muted-note">Current session is identified from your active refresh session cookie. You can revoke individual sessions.</p>
        {sessions.length === 0 ? (
          <div className="empty-state">No active sessions found.</div>
        ) : (
          <div className="sessions-list">
            {sessions.map(s => (
              <div key={s.session_id} className={`session-item ${s.is_current ? 'current' : ''}`}>
                <div className="session-main">
                  <div className="summary-row"><span>Device</span><strong>{s.device_name || s.user_agent || 'Unknown device'} {s.is_current ? '(Current)' : ''}</strong></div>
                  <div className="summary-row"><span>IP Address</span><strong>{s.ip_address || 'N/A'}</strong></div>
                  <div className="summary-row"><span>Created</span><strong>{s.created_at ? new Date(s.created_at).toLocaleString() : 'N/A'}</strong></div>
                  <div className="summary-row"><span>Last Active</span><strong>{s.last_used_at ? new Date(s.last_used_at).toLocaleString() : 'N/A'}</strong></div>
                  <div className="summary-row"><span>Expires</span><strong>{s.expires_at ? new Date(s.expires_at).toLocaleString() : 'N/A'}</strong></div>
                </div>
                <div className="session-actions">
                  <button className="btn-secondary danger-btn" onClick={() => onRevoke(s.session_id, s.is_current)}>Revoke Session</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
