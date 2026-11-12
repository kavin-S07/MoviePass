from pydantic import BaseModel, Field, ConfigDict
from datetime import date, time


# Dashboard stats
class SummaryStats(BaseModel):

    total_theatres: int
    total_screens: int
    total_movies: int
    total_shows: int
    upcoming_shows: int


class RecentTheatre(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    theatre_id: int
    name: str
    city: str | None = None
    address: str
    status: str


class UpcomingShow(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    show_id: int
    movie_name: str
    screen_name: str
    theatre_name: str
    show_date: date
    start_time: time
    status: str


class DashboardStats(BaseModel):

    summary: SummaryStats
    recent_theatres: list[RecentTheatre]
    upcoming_shows: list[UpcomingShow]


# Theatre create / update request
class TheatrePayload(BaseModel):

    name: str = Field(min_length=2, max_length=150)

    address: str = Field(min_length=5)

    city: str | None = Field(default=None, max_length=100)

    state: str | None = Field(default=None, max_length=100)

    pincode: str | None = Field(default=None, pattern=r"^[0-9]{6}$")

    latitude: float | None = Field(default=None, ge=-90, le=90)

    longitude: float | None = Field(default=None, ge=-180, le=180)

    contact_number: str | None = Field(
        default=None,
        pattern=r"^[0-9]{10}$"
    )

    status: str | None = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")


class TheatreResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    theatre_id: int
    owner_id: int
    name: str
    address: str
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    contact_number: str | None = None
    status: str
    screen_count: int | None = None


class ScreenBrief(BaseModel):

    screen_id: int
    screen_name: str
    no_of_rows: int
    no_of_columns: int
    status: str
    seat_count: int | None = None


class TheatreDetails(TheatreResponse):

    screens: list[ScreenBrief] = []
