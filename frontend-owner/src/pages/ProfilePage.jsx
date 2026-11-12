import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {

  const { user, logout } = useAuth()

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Profile</h1>
          <p>Your account details.</p>
        </div>
      </header>

      <section className="panel">
        <dl className="details-grid">
          <div>
            <dt>Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user?.role}</dd>
          </div>
          <div>
            <dt>Account Status</dt>
            <dd>{user?.approval_status}</dd>
          </div>
        </dl>
        <button className="btn-secondary" onClick={logout}>Logout</button>
      </section>
    </div>
  )
}
