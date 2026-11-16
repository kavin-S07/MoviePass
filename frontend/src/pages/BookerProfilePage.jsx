export default function BookerProfilePage({ user, onLogout }) {
  if (!user) return <div className="page-state">No profile data available.</div>
  return (
    <div className="profile-page">
      <div className="page-header-row">
        <div>
          <h1>Profile</h1>
          <p>Account details from your current authenticated session.</p>
        </div>
      </div>
      <div className="profile-card-panel">
        <div className="profile-field"><span>Name</span><strong>{user.name || 'N/A'}</strong></div>
        <div className="profile-field"><span>Email</span><strong>{user.email || 'N/A'}</strong></div>
        <div className="profile-field"><span>Role</span><strong>{user.role || 'N/A'}</strong></div>
        <div className="profile-field"><span>Approval Status</span><strong>{user.approval_status || 'N/A'}</strong></div>
        <div className="profile-actions">
          <button className="btn-secondary" onClick={onLogout}>Logout</button>
        </div>
        <p className="muted-note">Profile editing, booking history, and notifications will be expanded in upcoming stages.</p>
      </div>
    </div>
  )
}
