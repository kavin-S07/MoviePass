from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from Modules.Theatres.Model import Theatre, Screen, Movie, Show


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


def count_movies(db: Session):

    return db.query(Movie).count()


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
