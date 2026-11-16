from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class BookerMovieListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    movie_id: int
    movie_name: str
    poster_url: Optional[str] = None
    release_date: Optional[date] = None
    director_name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    language: Optional[str] = None
    genre: Optional[str] = None
    certification: Optional[str] = None
    cast_names: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    release_status: str = "released"
    booking_available: bool = False
    upcoming_show_count: int = 0
    total_show_count: int = 0


class BookerMovieListResponse(BaseModel):
    items: List[BookerMovieListItem]
    total: int
    page: int
    page_size: int
    has_more: bool


class BookerMovieDetailResponse(BookerMovieListItem):
    pass


class BookerShowItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    show_id: int
    movie_id: int
    screen_id: int
    theatre_id: Optional[int] = None
    theatre_name: Optional[str] = None
    theatre_city: Optional[str] = None
    screen_name: Optional[str] = None
    show_date: date
    start_time: time
    end_time: time
    status: str


class BookerMovieFiltersResponse(BaseModel):
    languages: List[str]
    genres: List[str]
    certifications: List[str]
    cities: List[str]


class BookerHomeResponse(BaseModel):
    featured_movie: Optional[BookerMovieListItem] = None
    now_showing: List[BookerMovieListItem]
    coming_soon: List[BookerMovieListItem]
    trending: List[BookerMovieListItem]
    recommended: List[BookerMovieListItem]
    filters: BookerMovieFiltersResponse
