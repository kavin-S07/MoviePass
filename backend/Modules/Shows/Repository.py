from sqlalchemy import func
from sqlalchemy.orm import Session

from Modules.Bookings.Model import Booking, BookingSeat, SeatLock
from Modules.Theatres.Model import Movie, Screen, Seat, Show, Theatre


def list_owner_shows(db: Session, owner_id: int | None):
    query = db.query(
        Show.show_id,
        Show.movie_id,
        Show.screen_id,
        Show.show_date,
        Show.start_time,
        Show.end_time,
        Show.status,
        Show.created_at,
        Show.updated_at,
        Movie.movie_name,
        Screen.screen_name,
        Theatre.theatre_id,
        Theatre.name.label("theatre_name"),
    ).join(
        Screen, Show.screen_id == Screen.screen_id
    ).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).join(
        Movie, Show.movie_id == Movie.movie_id
    )

    if owner_id is not None:
        query = query.filter(Theatre.owner_id == owner_id)

    return query.order_by(
        Show.show_date.desc(),
        Show.start_time.desc(),
        Show.show_id.desc(),
    ).all()


def get_movie_by_id(db: Session, movie_id: int):
    return db.query(Movie).filter(Movie.movie_id == movie_id).first()


def get_screen_with_theatre(db: Session, screen_id: int):
    return db.query(Screen, Theatre).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).filter(
        Screen.screen_id == screen_id
    ).first()


def has_time_overlap(db: Session, screen_id: int, show_date, start_time, end_time) -> bool:
    # Basic overlap check for same screen/date: existing.start < new.end and existing.end > new.start
    existing = db.query(Show.show_id).filter(
        Show.screen_id == screen_id,
        Show.show_date == show_date,
        Show.status != "Cancelled",
        Show.start_time < end_time,
        Show.end_time > start_time,
    ).first()
    return existing is not None


def create_show(db: Session, data: dict):
    show = Show(**data)
    db.add(show)
    db.flush()
    return show


def get_show_enriched(db: Session, show_id: int):
    return db.query(
        Show.show_id,
        Show.movie_id,
        Show.screen_id,
        Show.show_date,
        Show.start_time,
        Show.end_time,
        Show.status,
        Show.created_at,
        Show.updated_at,
        Movie.movie_name,
        Screen.screen_name,
        Theatre.theatre_id,
        Theatre.name.label("theatre_name"),
    ).join(
        Screen, Show.screen_id == Screen.screen_id
    ).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).join(
        Movie, Show.movie_id == Movie.movie_id
    ).filter(
        Show.show_id == show_id
    ).first()


def get_show_booking_summary(db: Session, show_id: int):
    show = get_show_enriched(db, show_id)
    if not show:
        return None

    total_seats = db.query(func.count(Seat.seat_id)).filter(
        Seat.screen_id == show.screen_id,
        Seat.is_active == True,  # noqa: E712
    ).scalar() or 0

    booked_seats = db.query(func.count(func.distinct(BookingSeat.seat_id))).filter(
        BookingSeat.show_id == show_id,
        BookingSeat.seat_status.in_(["HELD", "CONFIRMED"]),
    ).scalar() or 0

    locked_seats = db.query(func.count(func.distinct(SeatLock.seat_id))).filter(
        SeatLock.show_id == show_id,
        SeatLock.lock_status == "ACTIVE",
        SeatLock.expires_at > func.now(),
    ).scalar() or 0

    # Avoid double-counting seats that are both locked and held in booking flow edge cases.
    locked_not_booked = db.query(func.count(func.distinct(SeatLock.seat_id))).filter(
        SeatLock.show_id == show_id,
        SeatLock.lock_status == "ACTIVE",
        SeatLock.expires_at > func.now(),
        ~SeatLock.seat_id.in_(
            db.query(BookingSeat.seat_id).filter(
                BookingSeat.show_id == show_id,
                BookingSeat.seat_status.in_(["HELD", "CONFIRMED"]),
            )
        ),
    ).scalar() or 0

    available_seats = max(total_seats - booked_seats - locked_not_booked, 0)

    booking_rows = db.query(
        Booking.booking_status,
        func.count(Booking.booking_id),
        func.coalesce(func.sum(Booking.total_amount), 0),
    ).filter(
        Booking.show_id == show_id,
    ).group_by(Booking.booking_status).all()

    counts = {status: int(count) for status, count, _ in booking_rows}
    revenue = {status: float(amount) for status, _, amount in booking_rows}

    total_bookings = sum(counts.values())
    confirmed_bookings = counts.get("CONFIRMED", 0)
    pending_bookings = counts.get("PENDING", 0) + counts.get("PAYMENT_PENDING", 0)
    cancelled_bookings = counts.get("CANCELLED", 0) + counts.get("EXPIRED", 0)
    failed_bookings = counts.get("FAILED", 0)

    total_revenue = sum(revenue.values())
    confirmed_revenue = revenue.get("CONFIRMED", 0.0)

    return {
        "show_id": show.show_id,
        "movie_name": show.movie_name,
        "theatre_id": show.theatre_id,
        "theatre_name": show.theatre_name,
        "screen_id": show.screen_id,
        "screen_name": show.screen_name,
        "show_date": show.show_date,
        "start_time": show.start_time,
        "end_time": show.end_time,
        "show_status": show.status,
        "total_seats": int(total_seats),
        "booked_seats": int(booked_seats),
        "locked_seats": int(locked_not_booked),
        "available_seats": int(available_seats),
        "total_bookings": int(total_bookings),
        "confirmed_bookings": int(confirmed_bookings),
        "pending_bookings": int(pending_bookings),
        "cancelled_bookings": int(cancelled_bookings),
        "failed_bookings": int(failed_bookings),
        "total_revenue": float(total_revenue),
        "confirmed_revenue": float(confirmed_revenue),
    }
