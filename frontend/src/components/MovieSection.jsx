import MovieCard from './MovieCard'

export default function MovieSection({ title, movies = [], onViewDetails, onBook, emptyText = 'No movies available.' }) {
  if (!movies.length) {
    return (
      <section className="movie-section">
        <div className="section-header"><h2>{title}</h2></div>
        <div className="empty-state inline-empty">{emptyText}</div>
      </section>
    )
  }

  return (
    <section className="movie-section">
      <div className="section-header"><h2>{title}</h2></div>
      <div className="movie-grid">
        {movies.map((movie) => (
          <MovieCard key={movie.movie_id} movie={movie} onViewDetails={onViewDetails} onBook={onBook} />
        ))}
      </div>
    </section>
  )
}
