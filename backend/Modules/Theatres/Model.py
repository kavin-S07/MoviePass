from sqlalchemy import Column, BigInteger, String, Text, Identity, ForeignKey, DECIMAL, Integer, Boolean, Date, Time, DateTime, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from config.database import Base
from datetime import datetime, timezone


class Movie(Base):

    __tablename__ = "movies"

    movie_id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    movie_name = Column(String(200), nullable=False)

    poster_url = Column(String(500), nullable=True)

    release_date = Column(Date, nullable=True)

    director_name = Column(String(150), nullable=True)

    description = Column(Text, nullable=True)

    duration_minutes = Column(Integer, nullable=True)

    language = Column(String(50), nullable=True)

    genre = Column(String(80), nullable=True)

    certification = Column(String(10), nullable=True)

    cast_names = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )


class Theatre(Base):

    __tablename__ = "theatres"

    theatre_id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    owner_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    name = Column(String(150), nullable=False)

    address = Column(Text, nullable=False)

    city = Column(String(100), nullable=True)

    state = Column(String(100), nullable=True)

    pincode = Column(String(10), nullable=True)

    latitude = Column(DECIMAL(9, 6), nullable=True)

    longitude = Column(DECIMAL(9, 6), nullable=True)

    contact_number = Column(String(15), nullable=True)

    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE"
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )


class Screen(Base):

    __tablename__ = "screens"

    screen_id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    theatre_id = Column(
        BigInteger,
        ForeignKey("theatres.theatre_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    screen_name = Column(String(100), nullable=False)

    screen_number = Column(Integer, nullable=True)

    no_of_rows = Column(Integer, nullable=False)

    no_of_columns = Column(Integer, nullable=False)

    has_categories = Column(
        Boolean,
        nullable=False,
        default=False
    )

    default_price = Column(DECIMAL(10, 2), nullable=True)

    layout_config = Column(
        JSONB,
        nullable=True
    )

    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE"
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint(
            "theatre_id",
            "screen_name",
            name="uq_screens_theatre_name"
        ),
    )


class SeatCategory(Base):

    __tablename__ = "seat_categories"

    category_id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    screen_id = Column(
        BigInteger,
        ForeignKey("screens.screen_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    category_name = Column(String(50), nullable=False)

    price = Column(DECIMAL(10, 2), nullable=False)

    color = Column(
        String(30),
        nullable=False,
        default="#3b82f6"
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint(
            "screen_id",
            "category_name",
            name="uq_categories_screen_name"
        ),
    )


class Seat(Base):

    __tablename__ = "seats"

    seat_id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    screen_id = Column(
        BigInteger,
        ForeignKey("screens.screen_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    category_id = Column(
        BigInteger,
        ForeignKey("seat_categories.category_id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    seat_name = Column(String(10), nullable=False)

    row_number = Column(Integer, nullable=False)

    column_number = Column(Integer, nullable=False)

    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint(
            "screen_id",
            "seat_name",
            name="uq_seats_screen_name"
        ),
        UniqueConstraint(
            "screen_id",
            "row_number",
            "column_number",
            name="uq_seats_screen_row_col"
        ),
    )


class Show(Base):

    __tablename__ = "shows"

    show_id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    screen_id = Column(
        BigInteger,
        ForeignKey("screens.screen_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    movie_id = Column(
        BigInteger,
        ForeignKey("movies.movie_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    show_date = Column(Date, nullable=False)

    start_time = Column(Time, nullable=False)

    end_time = Column(Time, nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="Scheduled"
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        CheckConstraint(
            "end_time > start_time",
            name="ck_shows_end_after_start"
        ),
    )
