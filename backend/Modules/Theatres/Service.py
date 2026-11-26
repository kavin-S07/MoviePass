from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Movies import Repository as MoviesRepository
from Modules.Theatres import Repository
from Modules.Theatres.Schema import (
    TheatreResponse,
    TheatreDetails,
    ScreenBrief,
    UpcomingShow,
    SummaryStats,
    DashboardStats
)

from fastapi import HTTPException, status


def _theatre_to_response(theatre, screen_count=None) -> dict:

    data = {
        "theatre_id": theatre.theatre_id,
        "owner_id": theatre.owner_id,
        "name": theatre.name,
        "address": theatre.address,
        "city": theatre.city,
        "state": theatre.state,
        "pincode": theatre.pincode,
        "latitude": float(theatre.latitude) if theatre.latitude is not None else None,
        "longitude": float(theatre.longitude) if theatre.longitude is not None else None,
        "contact_number": theatre.contact_number,
        "status": theatre.status,
    }

    if screen_count is not None:

        data["screen_count"] = screen_count

    return data


# Resolve the current principal as owner (or None for ADMIN who sees all)
def _access_scope(db: Session, token: str):

    user = AuthService.get_current_owner(db, token)

    if user.role == "ADMIN":

        return None   # sees everything

    return user.id


def resolve_theatre(db: Session, user, theatre_id: int | None = None):
    """Resolve the theatre an owner-scoped movie operation applies to.

    The theatre is always derived from the authenticated user, never taken on
    trust from the client:
      * theatre_id omitted -> the owner's own theatre.
      * theatre_id given   -> must exist and belong to the owner (admins may
                              target any theatre).
    """

    if theatre_id is None:

        theatre = Repository.get_theatre_by_owner_id(db, user.id)

        if not theatre:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not associated with a theatre",
            )

        return theatre

    theatre = Repository.get_theatre_by_id(db, theatre_id)

    if not theatre:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre not found",
        )

    if user.role != "ADMIN" and theatre.owner_id != user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this theatre",
        )

    return theatre


def get_my_theatre_movies(db: Session, token: str, search: str | None = None, theatre_id: int | None = None):
    """List movies mapped to the authenticated user's theatre (optionally by name)."""
    user = AuthService.get_current_owner(db, token)
    theatre = resolve_theatre(db, user, theatre_id)
    return Repository.list_theatre_movies(db, theatre.theatre_id, search=search)


def map_movie_to_theatre(db: Session, token: str, movie_id: int, theatre_id: int | None = None):
    """Map an existing global movie to the authenticated user's theatre.

    Idempotent: an existing mapping is returned without creating duplicates.
    Concurrent inserts are absorbed via the unique constraint.
    """
    user = AuthService.get_current_owner(db, token)
    theatre = resolve_theatre(db, user, theatre_id)

    movie = MoviesRepository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    existing = Repository.get_theatre_movie(db, theatre.theatre_id, movie.movie_id)
    if existing:
        return existing

    try:
        mapping = Repository.create_theatre_movie(db, theatre.theatre_id, movie.movie_id)
        db.commit()
        return mapping
    except IntegrityError:
        db.rollback()
        existing = Repository.get_theatre_movie(db, theatre.theatre_id, movie.movie_id)
        if not existing:
            raise
        return existing


# Dashboard stats
def get_dashboard(db: Session, token: str):

    user = AuthService.get_current_owner(db, token)

    owner_id = None if user.role == "ADMIN" else user.id

    screens = Repository.list_upcoming_shows(db, owner_id)

    return {
        "summary": {
            "total_theatres": Repository.count_theatres(db, owner_id),
            "total_screens": Repository.count_screens(db, owner_id),
            "total_movies": Repository.count_movies(db, owner_id),
            "total_shows": Repository.count_shows(db, owner_id),
            "upcoming_shows": Repository.count_upcoming_shows(db, owner_id),
        },
        "recent_theatres": [
            {
                "theatre_id": t.theatre_id,
                "name": t.name,
                "city": t.city,
                "address": t.address,
                "status": t.status,
            }
            for t in Repository.list_recent_theatres(db, owner_id)
        ],
        "upcoming_shows": [
            {
                "show_id": row.show_id,
                "movie_name": row.movie_name,
                "screen_name": row.screen_name,
                "theatre_name": row.theatre_name,
                "show_date": row.show_date,
                "start_time": row.start_time,
                "status": row.status,
            }
            for row in screens
        ]
    }


# List my theatres
def list_my_theatres(db: Session, token: str):

    user = AuthService.get_current_owner(db, token)

    owner_id = None if user.role == "ADMIN" else user.id

    theatres = Repository.list_theatres(db, owner_id)

    result = []

    for theatre in theatres:

        screens = Repository.list_screens_for_theatre(db, theatre.theatre_id)

        result.append(
            _theatre_to_response(theatre, len(screens))
        )

    return result


# Theatre details
def get_theatre(db: Session, token: str, theatre_id: int):

    user = AuthService.get_current_owner(db, token)

    theatre = Repository.get_theatre_by_id(db, theatre_id)

    if not theatre:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre not found"
        )

    # Owners may only see their own theatres
    if user.role != "ADMIN" and theatre.owner_id != user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this theatre"
        )

    screens = Repository.list_screens_for_theatre(db, theatre.theatre_id)

    return {
        **_theatre_to_response(theatre, len(screens)),
        "screens": [
            {
                "screen_id": screen.screen_id,
                "screen_name": screen.screen_name,
                "no_of_rows": screen.no_of_rows,
                "no_of_columns": screen.no_of_columns,
                "status": screen.status,
                "seat_count": screen.no_of_rows * screen.no_of_columns,
            }
            for screen in screens
        ]
    }


# Create theatre
def create_theatre(db: Session, token: str, payload):

    user = AuthService.get_current_owner(db, token)

    theatre = Repository.create_theatre(
        db,
        owner_id=user.id,
        data={
            "name": payload.name,
            "address": payload.address,
            "city": payload.city,
            "state": payload.state,
            "pincode": payload.pincode,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "contact_number": payload.contact_number,
            "status": payload.status or "ACTIVE",
        }
    )

    db.commit()

    return _theatre_to_response(theatre, 0)


# Update theatre
def update_theatre(db: Session, token: str, theatre_id: int, payload):

    user = AuthService.get_current_owner(db, token)

    theatre = Repository.get_theatre_by_id(db, theatre_id)

    if not theatre:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre not found"
        )

    if user.role != "ADMIN" and theatre.owner_id != user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this theatre"
        )

    # Only apply fields explicitly provided by the client to avoid unintended resets
    # (e.g. schema defaults overwriting existing values on partial payloads).
    data = payload.model_dump(include=payload.model_fields_set)

    # Preserve existing status when client does not provide a valid explicit value.
    if "status" not in data or data.get("status") is None:
        data["status"] = theatre.status or "ACTIVE"

    updated = Repository.update_theatre(db, theatre, data)

    db.commit()

    db.refresh(updated)

    screens = Repository.list_screens_for_theatre(db, updated.theatre_id)

    return _theatre_to_response(updated, len(screens))


# Delete theatre
def delete_theatre(db: Session, token: str, theatre_id: int):

    user = AuthService.get_current_owner(db, token)

    theatre = Repository.get_theatre_by_id(db, theatre_id)

    if not theatre:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre not found"
        )

    if user.role != "ADMIN" and theatre.owner_id != user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this theatre"
        )

    Repository.delete_theatre(db, theatre)

    db.commit()

    return {
        "message": "Theatre deleted successfully"
    }
