from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from config.database import get_db
from Modules.Auth.Dependencies import get_token
from Modules.Booker import Service
from Modules.Booker.Schema import (
    BookerHomeResponse,
    BookerMovieDetailResponse,
    BookerMovieFiltersResponse,
    BookerMovieListResponse,
    BookerShowItem,
)

router = APIRouter(prefix="/booker", tags=["Booker Discovery"])


@router.get("/home", response_model=BookerHomeResponse, status_code=status.HTTP_200_OK)
def booker_home(
    city: str | None = Query(default=None),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_home(db, token, city=city)


@router.get("/movies", response_model=BookerMovieListResponse, status_code=status.HTTP_200_OK)
def list_movies(
    search: str | None = Query(default=None),
    language: str | None = Query(default=None),
    genre: str | None = Query(default=None),
    certification: str | None = Query(default=None),
    release_status: str | None = Query(default=None, pattern=r"^(now_showing|coming_soon|all)$"),
    city: str | None = Query(default=None),
    sort_by: str | None = Query(default="release_date_desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    if release_status == "all":
        release_status = None
    return Service.list_movies(
        db,
        token,
        search=search,
        language=language,
        genre=genre,
        certification=certification,
        release_status=release_status,
        city=city,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )


@router.get("/movies/filters", response_model=BookerMovieFiltersResponse, status_code=status.HTTP_200_OK)
def movie_filters(
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_filters(db, token)


@router.get("/movies/{movie_id}", response_model=BookerMovieDetailResponse, status_code=status.HTTP_200_OK)
def movie_detail(
    movie_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_movie(db, token, movie_id)


@router.get("/movies/{movie_id}/shows", response_model=list[BookerShowItem], status_code=status.HTTP_200_OK)
def movie_shows(
    movie_id: int,
    city: str | None = Query(default=None),
    show_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_movie_shows(db, token, movie_id, city=city, show_date=show_date)
