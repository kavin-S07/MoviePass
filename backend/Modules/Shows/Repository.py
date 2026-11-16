from sqlalchemy.orm import Session

from Modules.Theatres.Model import Movie, Screen, Show, Theatre


def list_owner_shows(db: Session, owner_id: int | None):
    query = db.query(
        Show.show_id,
        Show.movie_id,
        Show.screen_id,
        Show.show_date,
        Show.start_time,
        Show.end_time,
        Show.status,
        Show.created_at,
        Show.updated_at,
        Movie.movie_name,
        Screen.screen_name,
        Theatre.theatre_id,
        Theatre.name.label("theatre_name"),
    ).join(
        Screen, Show.screen_id == Screen.screen_id
    ).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).join(
        Movie, Show.movie_id == Movie.movie_id
    )

    if owner_id is not None:
        query = query.filter(Theatre.owner_id == owner_id)

    return query.order_by(
        Show.show_date.desc(),
        Show.start_time.desc(),
        Show.show_id.desc(),
    ).all()


def get_movie_by_id(db: Session, movie_id: int):
    return db.query(Movie).filter(Movie.movie_id == movie_id).first()


def get_screen_with_theatre(db: Session, screen_id: int):
    return db.query(Screen, Theatre).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).filter(
        Screen.screen_id == screen_id
    ).first()


def has_time_overlap(db: Session, screen_id: int, show_date, start_time, end_time) -> bool:
    # Basic overlap check for same screen/date: existing.start < new.end and existing.end > new.start
    existing = db.query(Show.show_id).filter(
        Show.screen_id == screen_id,
        Show.show_date == show_date,
        Show.status != "Cancelled",
        Show.start_time < end_time,
        Show.end_time > start_time,
    ).first()
    return existing is not None


def create_show(db: Session, data: dict):
    show = Show(**data)
    db.add(show)
    db.flush()
    return show


def get_show_enriched(db: Session, show_id: int):
    return db.query(
        Show.show_id,
        Show.movie_id,
        Show.screen_id,
        Show.show_date,
        Show.start_time,
        Show.end_time,
        Show.status,
        Show.created_at,
        Show.updated_at,
        Movie.movie_name,
        Screen.screen_name,
        Theatre.theatre_id,
        Theatre.name.label("theatre_name"),
    ).join(
        Screen, Show.screen_id == Screen.screen_id
    ).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).join(
        Movie, Show.movie_id == Movie.movie_id
    ).filter(
        Show.show_id == show_id
    ).first()
