from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Movies import Repository
from Modules.Theatres import Repository as TheatresRepository
from Modules.Theatres import Service as TheatresService


_TEXT_FIELDS = [
    "movie_name",
    "poster_url",
    "director_name",
    "description",
    "language",
    "genre",
    "certification",
    "cast_names",
]

# Every user-editable column of a movie (used to decide "unchanged").
_DETAIL_FIELDS = _TEXT_FIELDS + ["release_date", "duration_minutes"]


def _clean_text(key: str, value):
    if isinstance(value, str):
        value = value.strip()
        if key != "movie_name" and value == "":
            return None
    return value


def _normalize_movie_data(payload) -> dict:
    # source_movie_id / theatre_id are request routing hints, not movie columns.
    data = payload.model_dump(exclude={"source_movie_id", "theatre_id"})
    # Trim common text fields and normalize empty strings to None for optional fields.
    for key in _TEXT_FIELDS:
        data[key] = _clean_text(key, data.get(key))
    return data


def _matches_existing(movie, data: dict) -> bool:
    """True when the submitted details are identical to the stored movie."""
    for key in _DETAIL_FIELDS:
        if _clean_text(key, getattr(movie, key)) != data.get(key):
            return False
    return True


def list_movies(
    db: Session,
    token: str,
    search: str | None = None,
    exclude_mapped: bool = False,
    theatre_id: int | None = None,
):
    # Accessible to authenticated approved owners/admins.
    user = AuthService.get_current_owner(db, token)

    exclude_theatre_id = None
    if exclude_mapped:
        # "Show Movies": the global catalogue minus what this theatre already has.
        exclude_theatre_id = TheatresService.resolve_theatre(db, user, theatre_id).theatre_id

    return Repository.list_movies(db, search=search, exclude_theatre_id=exclude_theatre_id)


def get_movie(db: Session, token: str, movie_id: int):
    AuthService.get_current_owner(db, token)
    movie = Repository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    return movie


def _as_add_response(movie, theatre_id: int | None, reused_existing: bool) -> dict:
    return {
        "movie_id": movie.movie_id,
        "movie_name": movie.movie_name,
        "poster_url": movie.poster_url,
        "release_date": movie.release_date,
        "director_name": movie.director_name,
        "description": movie.description,
        "duration_minutes": movie.duration_minutes,
        "language": movie.language,
        "genre": movie.genre,
        "certification": movie.certification,
        "cast_names": movie.cast_names,
        "created_at": movie.created_at,
        "updated_at": movie.updated_at,
        "theatre_id": theatre_id,
        "reused_existing": reused_existing,
    }


def create_movie(db: Session, token: str, payload):
    user = AuthService.get_current_owner(db, token)
    data = _normalize_movie_data(payload)

    # Admins manage the global catalogue directly (no theatre mapping).
    if user.role == "ADMIN":
        movie = Repository.create_movie(db, data)
        db.commit()
        db.refresh(movie)
        return _as_add_response(movie, None, False)

    # Theatre owner: the target theatre comes from the authenticated user.
    theatre = TheatresService.resolve_theatre(db, user, payload.theatre_id)
    theatre_id = theatre.theatre_id

    source = None
    if payload.source_movie_id is not None:
        source = Repository.get_movie_by_id(db, payload.source_movie_id)
        if not source:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected movie not found")

    reuse = source is not None and _matches_existing(source, data)

    try:
        if reuse:
            # Nothing changed: keep the shared record, add only the mapping.
            if TheatresRepository.get_theatre_movie(db, theatre_id, source.movie_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This movie is already added to your theatre",
                )
            movie = source
        else:
            # New or edited details: a separate record, never an edit of the
            # shared one, mapped only to this theatre.
            movie = Repository.create_movie(db, data)

        TheatresRepository.create_theatre_movie(db, theatre_id, movie.movie_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        # A concurrent request may have created the same mapping (unique
        # constraint). Report that precisely; anything else is a real error.
        if reuse and TheatresRepository.get_theatre_movie(db, theatre_id, source.movie_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This movie is already added to your theatre",
            )
        raise
    except HTTPException:
        db.rollback()
        raise

    db.refresh(movie)
    return _as_add_response(movie, theatre_id, reuse)


def _assert_owner_can_modify(db: Session, user, movie_id: int) -> tuple[set[int], set[int]]:
    """Owners may only touch a movie that belongs exclusively to their theatres.

    Returns (owner_theatre_ids, movie_theatre_ids).
    """
    owner_theatres = TheatresRepository.list_owner_theatre_ids(db, user.id)
    movie_theatres = TheatresRepository.list_movie_theatre_ids(db, movie_id)

    if not (owner_theatres & movie_theatres):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This movie is not part of your theatre",
        )

    return owner_theatres, movie_theatres


def update_movie(db: Session, token: str, movie_id: int, payload):
    user = AuthService.get_current_owner(db, token)
    movie = Repository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    if user.role != "ADMIN":
        owner_theatres, movie_theatres = _assert_owner_can_modify(db, user, movie_id)
        if movie_theatres - owner_theatres:
            # Editing in place would silently change the movie for other theatres.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This movie is shared with other theatres and cannot be edited. "
                    "Use Add Movie > Show Movies to create your own edited copy."
                ),
            )

    data = _normalize_movie_data(payload)
    data["updated_at"] = datetime.now(timezone.utc)
    Repository.update_movie(db, movie, data)
    db.commit()
    db.refresh(movie)
    return movie


def delete_movie(db: Session, token: str, movie_id: int):
    user = AuthService.get_current_owner(db, token)
    movie = Repository.get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    if user.role != "ADMIN":
        owner_theatres, movie_theatres = _assert_owner_can_modify(db, user, movie_id)

        if movie_theatres - owner_theatres:
            # Shared with other theatres: remove it from this owner's theatre only.
            if TheatresRepository.movie_has_shows_in_theatres(db, movie_id, owner_theatres):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove a movie that is referenced by existing shows",
                )
            TheatresRepository.delete_theatre_movies(db, movie_id, owner_theatres)
            db.commit()
            return {"message": "Movie removed from your theatre"}

    if Repository.movie_has_shows(db, movie_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a movie that is referenced by existing shows",
        )

    # Remove mappings explicitly so this also works where the database has no
    # ON DELETE CASCADE on theatre_movies.movie_id.
    TheatresRepository.delete_theatre_movies(db, movie_id)
    Repository.delete_movie(db, movie)
    db.commit()
    return {"message": "Movie deleted successfully"}
