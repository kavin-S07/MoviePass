// Placeholder until Phase 3 (Screen & Seat layout management) is built
export default function ScreensPage() {

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Add Screen</h1>
          <p>Configure the screen name, rows and columns, then design the seat layout.</p>
        </div>
      </header>

      <div className="panel empty-state">
        <p>Screen and seat-layout management will be implemented in Phase 3.</p>
        <p className="muted">It will generate the full seat editor with categories, prices and blocked seats.</p>
      </div>
    </div>
  )
}
