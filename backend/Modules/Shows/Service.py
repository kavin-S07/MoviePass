from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Shows import Repository


def _row_to_dict(row):
    return {
        "show_id": row.show_id,
        "movie_id": row.movie_id,
        "screen_id": row.screen_id,
        "theatre_id": getattr(row, "theatre_id", None),
        "movie_name": row.movie_name,
        "theatre_name": row.theatre_name,
        "screen_name": row.screen_name,
        "show_date": row.show_date,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "status": row.status,
        "created_at": getattr(row, "created_at", None),
        "updated_at": getattr(row, "updated_at", None),
    }


def list_shows(db: Session, token: str):
    user = AuthService.get_current_owner(db, token)
    owner_id = None if user.role == "ADMIN" else user.id
    rows = Repository.list_owner_shows(db, owner_id)
    return [_row_to_dict(row) for row in rows]


def create_show(db: Session, token: str, payload):
    user = AuthService.get_current_owner(db, token)

    movie = Repository.get_movie_by_id(db, payload.movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    screen_theatre = Repository.get_screen_with_theatre(db, payload.screen_id)
    if not screen_theatre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screen not found")

    screen, theatre = screen_theatre
    if user.role != "ADMIN" and theatre.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this screen",
        )

    # Basic overlap/conflict prevention for the same screen/date/time window.
    if Repository.has_time_overlap(db, payload.screen_id, payload.show_date, payload.start_time, payload.end_time):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This screen already has a show scheduled in the selected time window",
        )

    show = Repository.create_show(
        db,
        {
            "movie_id": payload.movie_id,
            "screen_id": payload.screen_id,
            "show_date": payload.show_date,
            "start_time": payload.start_time,
            "end_time": payload.end_time,
            "status": payload.status or "Scheduled",
        },
    )
    db.commit()

    enriched = Repository.get_show_enriched(db, show.show_id)
    if not enriched:
        # Fallback (should not happen)
        return {
            "show_id": show.show_id,
            "movie_id": show.movie_id,
            "screen_id": show.screen_id,
            "theatre_id": theatre.theatre_id,
            "movie_name": movie.movie_name,
            "theatre_name": theatre.name,
            "screen_name": screen.screen_name,
            "show_date": show.show_date,
            "start_time": show.start_time,
            "end_time": show.end_time,
            "status": show.status,
        }
    return _row_to_dict(enriched)
