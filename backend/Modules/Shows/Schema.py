from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ShowCreate(BaseModel):
    movie_id: int = Field(ge=1)
    screen_id: int = Field(ge=1)
    show_date: date
    start_time: time
    end_time: time
    status: str = Field(default="Scheduled", pattern=r"^(Scheduled|Cancelled|Completed)$")

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ShowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    show_id: int
    movie_id: int
    screen_id: int
    theatre_id: int | None = None
    movie_name: str | None = None
    theatre_name: str | None = None
    screen_name: str | None = None
    show_date: date
    start_time: time
    end_time: time
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ShowBookingSummaryResponse(BaseModel):
    show_id: int
    movie_name: str | None = None
    theatre_id: int | None = None
    theatre_name: str | None = None
    screen_id: int | None = None
    screen_name: str | None = None
    show_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    show_status: str | None = None

    total_seats: int = 0
    booked_seats: int = 0
    locked_seats: int = 0
    available_seats: int = 0

    total_bookings: int = 0
    confirmed_bookings: int = 0
    pending_bookings: int = 0
    cancelled_bookings: int = 0
    failed_bookings: int = 0

    total_revenue: float = 0
    confirmed_revenue: float = 0
