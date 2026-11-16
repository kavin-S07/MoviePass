import MovieSection from '../components/MovieSection'

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export default function BookerHomePage({ data, loading, error, onRetry, onViewDetails, onBook }) {
  if (loading) return <div className="page-state">Loading dashboard...</div>
  if (error) return <div className="page-state error-state-box"><p>{error}</p><button className="btn-primary" onClick={onRetry}>Retry</button></div>
  if (!data) return <div className="page-state">No dashboard data available.</div>

  const featured = data.featured_movie

  return (
    <div className="booker-home">
      {featured ? (
        <section className="hero-section">
          <div className="hero-bg" style={featured.poster_url ? { backgroundImage: `linear-gradient(90deg, rgba(10,12,20,.95) 20%, rgba(10,12,20,.55) 55%, rgba(10,12,20,.2) 100%), url(${featured.poster_url})` } : undefined} />
          <div className="hero-content">
            <div className="hero-poster-wrap">
              {featured.poster_url ? <img src={featured.poster_url} alt={featured.movie_name} className="hero-poster" /> : <div className="hero-poster placeholder-poster">No Poster</div>}
            </div>
            <div className="hero-info">
              <p className="eyebrow">Featured Movie</p>
              <h1>{featured.movie_name}</h1>
              <p className="hero-meta">{featured.genre || 'Genre N/A'} • {featured.language || 'Language N/A'} • {formatDuration(featured.duration_minutes)} • {featured.certification || 'NR'}</p>
              <p className="hero-meta">Release: {featured.release_date || 'TBA'} • Status: {featured.release_status === 'coming_soon' ? 'Coming Soon' : 'Now Showing'}</p>
              <p className="hero-desc">{featured.description || 'No description available for this movie yet.'}</p>
              <div className="hero-actions">
                <button className="btn-secondary" onClick={() => onViewDetails(featured)}>View Details</button>
                {featured.booking_available ? (
                  <button className="btn-primary" onClick={() => onBook(featured)}>Book Tickets</button>
                ) : (
                  <button className="btn-disabled" disabled>{featured.release_status === 'coming_soon' ? 'Booking Opens Soon' : 'Booking Not Available'}</button>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="empty-state hero-empty">No featured movies available yet. Add movies and shows to see recommendations here.</div>
      )}

      <MovieSection title="Now Showing" movies={data.now_showing || []} onViewDetails={onViewDetails} onBook={onBook} emptyText="No movies are currently showing." />
      <MovieSection title="Coming Soon" movies={data.coming_soon || []} onViewDetails={onViewDetails} onBook={onBook} emptyText="No upcoming movies found." />
      <MovieSection title="Trending Movies" movies={data.trending || []} onViewDetails={onViewDetails} onBook={onBook} emptyText="Trending movies will appear when show data is available." />
      {(data.recommended || []).length > 0 && (
        <MovieSection title="Recommended Movies" movies={data.recommended} onViewDetails={onViewDetails} onBook={onBook} />
      )}
    </div>
  )
}
