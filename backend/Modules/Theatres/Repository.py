from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from Modules.Movies.Repository import name_search_pattern
from Modules.Theatres.Model import Theatre, TheatreMovie, Screen, Movie, Show


# Find theatres for an owner (or all for an admin)
def list_theatres(db: Session, owner_id: int | None):

    query = db.query(Theatre)

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.order_by(Theatre.created_at.desc()).all()


# List recent theatres for dashboard
def list_recent_theatres(db: Session, owner_id: int | None, limit: int = 5):

    query = db.query(Theatre)

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.order_by(Theatre.created_at.desc()).limit(limit).all()


# Find theatre by id
def get_theatre_by_id(db: Session, theatre_id: int):

    return db.query(Theatre).filter(
        Theatre.theatre_id == theatre_id
    ).first()


# Create theatre
def create_theatre(db: Session, owner_id: int, data: dict):

    theatre = Theatre(
        owner_id=owner_id,
        **data
    )

    db.add(theatre)

    db.flush()

    return theatre


# Update theatre
def update_theatre(db: Session, theatre: Theatre, data: dict):

    for key, value in data.items():

        setattr(theatre, key, value)

    db.flush()

    return theatre


# Delete theatre
def delete_theatre(db: Session, theatre: Theatre):

    db.delete(theatre)

    db.flush()


# Count screens per theatre
def count_screens(db: Session, owner_id: int | None):

    query = db.query(Screen).join(Theatre)

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.count()


def count_theatres(db: Session, owner_id: int | None):

    query = db.query(Theatre)

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.count()


# Movies on the dashboard: an owner sees only movies mapped to their own
# theatres; an admin (owner_id is None) sees the whole global catalogue.
def count_movies(db: Session, owner_id: int | None = None):

    if owner_id is None:

        return db.query(Movie).count()

    return (
        db.query(func.count(func.distinct(TheatreMovie.movie_id)))
        .join(Theatre, Theatre.theatre_id == TheatreMovie.theatre_id)
        .filter(Theatre.owner_id == owner_id)
        .scalar()
    ) or 0


def count_shows(db: Session, owner_id: int | None):

    query = db.query(Show).join(Screen, Show.screen_id == Screen.screen_id).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    )

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.count()


def count_upcoming_shows(db: Session, owner_id: int | None):

    query = db.query(Show).join(
        Screen, Show.screen_id == Screen.screen_id
    ).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).filter(
        Show.show_date >= date.today()
    )

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.count()


# List upcoming shows for dashboard
def list_upcoming_shows(db: Session, owner_id: int | None, limit: int = 5):

    query = db.query(
        Show.show_id,
        Show.show_date,
        Show.start_time,
        Show.status,
        Movie.movie_name,
        Screen.screen_name,
        Theatre.name.label("theatre_name")
    ).join(
        Screen, Show.screen_id == Screen.screen_id
    ).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).join(
        Movie, Show.movie_id == Movie.movie_id
    ).filter(
        Show.show_date >= date.today()
    )

    if owner_id is not None:

        query = query.filter(Theatre.owner_id == owner_id)

    return query.order_by(
        Show.show_date.asc(),
        Show.start_time.asc()
    ).limit(limit).all()


def list_screens_for_theatre(db: Session, theatre_id: int):

    return db.query(Screen).filter(
        Screen.theatre_id == theatre_id
    ).order_by(
        Screen.screen_name.asc()
    ).all()


# Find the (first) theatre owned by a user
def get_theatre_by_owner_id(db: Session, owner_id: int):

    return db.query(Theatre).filter(
        Theatre.owner_id == owner_id
    ).order_by(Theatre.created_at.desc()).first()


# List movies mapped to a theatre (optionally filtered by movie name)
def list_theatre_movies(db: Session, theatre_id: int, search: str | None = None):

    query = (
        db.query(Movie)
        .join(TheatreMovie, TheatreMovie.movie_id == Movie.movie_id)
        .filter(TheatreMovie.theatre_id == theatre_id)
    )

    if search and search.strip():

        query = query.filter(Movie.movie_name.ilike(name_search_pattern(search), escape="\\"))

    return query.order_by(Movie.created_at.desc(), Movie.movie_id.desc()).all()


# Find the mapping row between a theatre and a movie
def get_theatre_movie(db: Session, theatre_id: int, movie_id: int):

    return db.query(TheatreMovie).filter(
        TheatreMovie.theatre_id == theatre_id,
        TheatreMovie.movie_id == movie_id,
    ).first()


# Create a theatre->movie mapping (caller handles unique-constraint races)
def create_theatre_movie(db: Session, theatre_id: int, movie_id: int):

    mapping = TheatreMovie(theatre_id=theatre_id, movie_id=movie_id)
    db.add(mapping)
    db.flush()
    return mapping


# ---- Ownership / sharing helpers used by the Movies module ----

# Ids of every theatre owned by a user
def list_owner_theatre_ids(db: Session, owner_id: int) -> set[int]:

    rows = db.query(Theatre.theatre_id).filter(Theatre.owner_id == owner_id).all()

    return {row[0] for row in rows}


# Ids of every theatre a movie is mapped to
def list_movie_theatre_ids(db: Session, movie_id: int) -> set[int]:

    rows = db.query(TheatreMovie.theatre_id).filter(
        TheatreMovie.movie_id == movie_id
    ).all()

    return {row[0] for row in rows}


# Remove the mapping rows for a movie (all theatres, or only the given ones)
def delete_theatre_movies(db: Session, movie_id: int, theatre_ids: set[int] | None = None):

    query = db.query(TheatreMovie).filter(TheatreMovie.movie_id == movie_id)

    if theatre_ids is not None:

        query = query.filter(TheatreMovie.theatre_id.in_(theatre_ids))

    query.delete(synchronize_session=False)

    db.flush()


# True when any of the given theatres has a show scheduled for the movie
def movie_has_shows_in_theatres(db: Session, movie_id: int, theatre_ids: set[int]) -> bool:

    if not theatre_ids:

        return False

    return db.query(Show.show_id).join(
        Screen, Screen.screen_id == Show.screen_id
    ).filter(
        Show.movie_id == movie_id,
        Screen.theatre_id.in_(theatre_ids),
    ).first() is not None
