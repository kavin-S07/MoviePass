from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Movies import Repository


def _normalize_movie_data(payload) -> dict:
    data = payload.model_dump()
    # Trim common text fields and normalize empty strings to None for optional fields.
    for key in [
        "movie_name",
        "poster_url",
        "director_name",
        "description",
        "language",
        "genre",
        "certification",
        "cast_names",
    ]:
        value = data.get(key)
        if isinstance(value, str):
            value = value.strip()
            if key != "movie_name" and value == "":
                value = None
            data[key] = value
    return data


def list_movies(db: Session, token: str, search: str | None = None):
    # Accessible to authenticated approved owners/admins (and consistent with owner app usage).
    AuthService.get_current_owner(db, token)
    return Repository.list_movies(db, search=search)


def get_movie(db: Session, token: str, movie_id: int):
    AuthService.get_current_owner(db, token)
    movie = Repository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    return movie


def create_movie(db: Session, token: str, payload):
    AuthService.get_current_owner(db, token)
    data = _normalize_movie_data(payload)
    movie = Repository.create_movie(db, data)
    db.commit()
    db.refresh(movie)
    return movie


def update_movie(db: Session, token: str, movie_id: int, payload):
    AuthService.get_current_owner(db, token)
    movie = Repository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    data = _normalize_movie_data(payload)
    data["updated_at"] = datetime.now(timezone.utc)
    Repository.update_movie(db, movie, data)
    db.commit()
    db.refresh(movie)
    return movie


def delete_movie(db: Session, token: str, movie_id: int):
    AuthService.get_current_owner(db, token)
    movie = Repository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    if Repository.movie_has_shows(db, movie_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a movie that is referenced by existing shows",
        )

    Repository.delete_movie(db, movie)
    db.commit()
    return {"message": "Movie deleted successfully"}
