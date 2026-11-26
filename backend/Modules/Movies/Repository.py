from sqlalchemy.orm import Session

from Modules.Theatres.Model import Movie, Show, TheatreMovie


# Build a safe "contains" pattern for ILIKE: %, _ and \ typed by the user are
# treated as literal characters. Use together with escape="\\".
def name_search_pattern(term: str) -> str:
    escaped = term.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def list_movies(
    db: Session,
    search: str | None = None,
    exclude_theatre_id: int | None = None,
):
    query = db.query(Movie)

    if search and search.strip():
        query = query.filter(Movie.movie_name.ilike(name_search_pattern(search), escape="\\"))

    # Hide movies already mapped to this theatre. Movies mapped only to
    # *other* theatres are intentionally still returned.
    if exclude_theatre_id is not None:
        mapped_ids = db.query(TheatreMovie.movie_id).filter(
            TheatreMovie.theatre_id == exclude_theatre_id
        )
        query = query.filter(~Movie.movie_id.in_(mapped_ids))

    return query.order_by(Movie.created_at.desc(), Movie.movie_id.desc()).all()


def get_movie_by_id(db: Session, movie_id: int):
    return db.query(Movie).filter(Movie.movie_id == movie_id).first()


def create_movie(db: Session, data: dict):
    movie = Movie(**data)
    db.add(movie)
    db.flush()
    return movie


def update_movie(db: Session, movie: Movie, data: dict):
    for key, value in data.items():
        setattr(movie, key, value)
    db.flush()
    return movie


def movie_has_shows(db: Session, movie_id: int) -> bool:
    return db.query(Show.show_id).filter(Show.movie_id == movie_id).first() is not None


def delete_movie(db: Session, movie: Movie):
    db.delete(movie)
    db.flush()
