// Placeholder until Phase 4 (Movie management) is built
export default function MoviesPage() {

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Movies</h1>
          <p>Movie catalogue managed by Admin. Phase 4 will enable selecting movies for shows.</p>
        </div>
      </header>

      <div className="panel empty-state">
        <p>Movies will appear here once the Admin publishes them to the central catalogue.</p>
        <button className="btn-secondary" disabled>
          Request Movie (coming in Phase 4)
        </button>
      </div>
    </div>
  )
}
