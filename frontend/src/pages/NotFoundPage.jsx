import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="page-state">
      <h1>404 - Page Not Found</h1>
      <p>The page you requested does not exist or the route is invalid.</p>
      <Link className="btn-primary" to="/">Go to Home</Link>
    </div>
  )
}
