// Placeholder until Phase 5 (Show management) is built
export default function ShowsPage() {

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Shows</h1>
          <p>Schedule movies to your screens. Phase 5 will enable creating shows and pricing.</p>
        </div>
      </header>

      <div className="panel empty-state">
        <p>No shows scheduled yet. Create screens and configure seat categories first.</p>
        <button className="btn-secondary" disabled>
          Create Show (coming in Phase 5)
        </button>
      </div>
    </div>
  )
}
