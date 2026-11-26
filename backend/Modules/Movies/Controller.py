from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from config.database import get_db
from Modules.Auth.Dependencies import get_token
from Modules.Movies import Service
from Modules.Movies.Schema import MovieAddResponse, MovieCreate, MovieResponse, MovieUpdate


router = APIRouter(tags=["Movies"])


@router.get("/movies", response_model=List[MovieResponse], status_code=status.HTTP_200_OK)
def list_movies(
    search: str | None = Query(default=None, description="Search movies by name"),
    exclude_mapped: bool = Query(
        default=False,
        description="Exclude movies already mapped to the caller's theatre (used by Add Movie > Show Movies)",
    ),
    theatre_id: int | None = Query(
        default=None,
        description="Optional; only used with exclude_mapped and must be a theatre you own",
    ),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_movies(
        db, token, search=search, exclude_mapped=exclude_mapped, theatre_id=theatre_id
    )


@router.get("/movies/{movie_id}", response_model=MovieResponse, status_code=status.HTTP_200_OK)
def get_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_movie(db, token, movie_id)


@router.post("/movies", response_model=MovieAddResponse, status_code=status.HTTP_201_CREATED)
def create_movie(
    payload: MovieCreate,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.create_movie(db, token, payload)


@router.put("/movies/{movie_id}", response_model=MovieResponse, status_code=status.HTTP_200_OK)
def update_movie(
    movie_id: int,
    payload: MovieUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.update_movie(db, token, movie_id, payload)


@router.delete("/movies/{movie_id}", status_code=status.HTTP_200_OK)
def delete_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.delete_movie(db, token, movie_id)
