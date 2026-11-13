from sqlalchemy.orm import Session

from Modules.Theatres.Model import Movie, Show


def list_movies(db: Session, search: str | None = None):
    query = db.query(Movie)

    if search:
        query = query.filter(Movie.movie_name.ilike(f"%{search}%"))

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
