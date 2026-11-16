from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, Field


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int = Field(validation_alias="id")
    name: str
    email: str
    role: str
    phone_no: str | None = None
    approval_status: str


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    page_size: int


class AdminTheatreItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theatre_id: int
    owner_id: int
    owner_name: str | None = None
    owner_email: str | None = None
    name: str
    address: str
    city: str | None = None
    state: str | None = None
    contact_number: str | None = None
    status: str
    screen_count: int = 0
    created_at: datetime | None = None


class AdminTheatresResponse(BaseModel):
    items: list[AdminTheatreItem]
    total: int
    page: int
    page_size: int


class AdminMovieItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    movie_id: int
    movie_name: str
    poster_url: str | None = None
    release_date: date | None = None
    director_name: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    language: str | None = None
    genre: str | None = None
    certification: str | None = None
    cast_names: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminMoviesResponse(BaseModel):
    items: list[AdminMovieItem]
    total: int
    page: int
    page_size: int


class AdminShowItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    show_id: int
    movie_id: int
    screen_id: int
    theatre_id: int | None = None
    movie_name: str | None = None
    theatre_name: str | None = None
    screen_name: str | None = None
    owner_name: str | None = None
    show_date: date
    start_time: time
    end_time: time
    status: str
    created_at: datetime | None = None


class AdminShowsResponse(BaseModel):
    items: list[AdminShowItem]
    total: int
    page: int
    page_size: int


class RoleCount(BaseModel):
    role: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class AdminOverview(BaseModel):
    summary: dict
    role_breakdown: list[RoleCount]
    owner_approval_breakdown: list[StatusCount]
    pending_owners: list[dict]
    recent_theatres: list[dict]
    upcoming_shows: list[dict]
