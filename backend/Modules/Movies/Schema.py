from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class MovieBase(BaseModel):
    movie_name: str = Field(min_length=1, max_length=200)
    poster_url: str | None = Field(default=None, max_length=500)
    release_date: date | None = None
    director_name: str | None = Field(default=None, max_length=150)
    description: str | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1000)
    language: str | None = Field(default=None, max_length=50)
    genre: str | None = Field(default=None, max_length=80)
    certification: str | None = Field(default=None, max_length=10)
    # Stored as comma-separated names in the Text column for compatibility.
    cast_names: str | None = None


class MovieCreate(MovieBase):
    # Optional: the global movie the owner picked from "Show Movies". The server
    # decides whether the submitted details still match it (reuse the record and
    # only map it) or differ (create a separate record mapped to the theatre).
    source_movie_id: int | None = Field(default=None, ge=1)
    # Optional: target theatre. Always validated against the authenticated
    # owner; when omitted the owner's own theatre is used.
    theatre_id: int | None = Field(default=None, ge=1)


class MovieUpdate(MovieBase):
    pass


class MovieResponse(BaseModel):
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


class MovieAddResponse(MovieResponse):
    """Result of POST /movies: the movie plus how it was added."""

    # Theatre the movie was mapped to (None for admin catalogue-only creation).
    theatre_id: int | None = None
    # True when an existing global record was reused (only a mapping was created).
    reused_existing: bool = False
