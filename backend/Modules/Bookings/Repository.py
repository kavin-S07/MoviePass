from datetime import datetime, timedelta, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from Modules.Bookings.Model import Booking, BookingSeat, Payment, SeatLock, Ticket
from Modules.Theatres.Model import Movie, Screen, Seat, SeatCategory, Show, Theatre


def utcnow():
    return datetime.now(timezone.utc)


def get_show_with_screen(db: Session, show_id: int):
    return (
        db.query(Show, Screen, Theatre)
        .join(Screen, Show.screen_id == Screen.screen_id)
        .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
        .filter(Show.show_id == show_id)
        .first()
    )


def get_show_context_for_booking(db: Session, show_id: int):
    return (
        db.query(Show, Screen, Theatre, Movie)
        .join(Screen, Show.screen_id == Screen.screen_id)
        .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
        .join(Movie, Show.movie_id == Movie.movie_id)
        .filter(Show.show_id == show_id)
        .first()
    )


def list_screen_seats_with_category(db: Session, screen_id: int):
    return (
        db.query(Seat, SeatCategory)
        .outerjoin(SeatCategory, Seat.category_id == SeatCategory.category_id)
        .filter(Seat.screen_id == screen_id)
        .order_by(Seat.row_number.asc(), Seat.column_number.asc(), Seat.seat_id.asc())
        .all()
    )


def list_categories(db: Session, screen_id: int):
    return (
        db.query(SeatCategory)
        .filter(SeatCategory.screen_id == screen_id)
        .order_by(SeatCategory.price.asc(), SeatCategory.category_name.asc())
        .all()
    )


def expire_stale_locks(db: Session, show_id: int | None = None, now: datetime | None = None):
    now = now or utcnow()
    query = db.query(SeatLock).filter(
        SeatLock.lock_status == "ACTIVE",
        SeatLock.expires_at <= now,
    )
    if show_id is not None:
        query = query.filter(SeatLock.show_id == show_id)

    stale_locks = query.with_for_update(skip_locked=True).all()
    if not stale_locks:
        return []

    booking_ids = set()
    for lock in stale_locks:
        lock.lock_status = "EXPIRED"
        lock.released_at = now
        if lock.booking_id:
            booking_ids.add(lock.booking_id)

    if booking_ids:
        held_seats = (
            db.query(BookingSeat)
            .filter(
                BookingSeat.booking_id.in_(list(booking_ids)),
                BookingSeat.seat_status == "HELD",
            )
            .with_for_update()
            .all()
        )
        expired_lock_pairs = {(l.show_id, l.seat_id, l.booking_id) for l in stale_locks}
        for bs in held_seats:
            if (bs.show_id, bs.seat_id, bs.booking_id) in expired_lock_pairs:
                bs.seat_status = "RELEASED"

        bookings = db.query(Booking).filter(Booking.booking_id.in_(list(booking_ids))).with_for_update().all()
        for b in bookings:
            remaining_held = (
                db.query(BookingSeat)
                .filter(BookingSeat.booking_id == b.booking_id, BookingSeat.seat_status == "HELD")
                .count()
            )
            if remaining_held == 0 and b.booking_status in ("PENDING", "PAYMENT_PENDING"):
                b.booking_status = "EXPIRED"
                b.cancelled_at = now
                b.updated_at = now

    db.flush()
    return stale_locks


def get_booked_or_held_seat_ids(db: Session, show_id: int):
    rows = (
        db.query(BookingSeat.seat_id)
        .filter(
            BookingSeat.show_id == show_id,
            BookingSeat.seat_status.in_(["HELD", "CONFIRMED"]),
        )
        .all()
    )
    return {r[0] for r in rows}


def get_active_locks_for_show(db: Session, show_id: int, now: datetime | None = None):
    now = now or utcnow()
    return (
        db.query(SeatLock)
        .filter(
            SeatLock.show_id == show_id,
            SeatLock.lock_status == "ACTIVE",
            SeatLock.expires_at > now,
        )
        .all()
    )


def get_active_locks_by_token_for_user(db: Session, lock_token: str, user_id: int, now: datetime | None = None, for_update: bool = False):
    now = now or utcnow()
    q = db.query(SeatLock).filter(
        SeatLock.lock_token == lock_token,
        SeatLock.user_id == user_id,
        SeatLock.lock_status == "ACTIVE",
        SeatLock.expires_at > now,
    )
    if for_update:
        q = q.with_for_update()
    return q.all()


def get_locks_by_token_for_user_any_status(db: Session, lock_token: str, user_id: int):
    return db.query(SeatLock).filter(SeatLock.lock_token == lock_token, SeatLock.user_id == user_id).all()


def get_active_locks_for_user_show(db: Session, show_id: int, user_id: int, lock_token: str | None = None, now: datetime | None = None):
    now = now or utcnow()
    query = db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.user_id == user_id,
        SeatLock.lock_status == "ACTIVE",
        SeatLock.expires_at > now,
    )
    if lock_token:
        query = query.filter(SeatLock.lock_token == lock_token)
    return query.all()


def get_seats_with_category_for_update(db: Session, seat_ids: list[int]):
    if not seat_ids:
        return []
    return (
        db.query(Seat, SeatCategory)
        .outerjoin(SeatCategory, Seat.category_id == SeatCategory.category_id)
        .filter(Seat.seat_id.in_(seat_ids))
        .order_by(Seat.seat_id.asc())
        .with_for_update(of=Seat)
        .all()
    )


def get_active_lock_rows_for_seats_for_update(db: Session, show_id: int, seat_ids: list[int], now: datetime | None = None):
    if not seat_ids:
        return []
    now = now or utcnow()
    return (
        db.query(SeatLock)
        .filter(
            SeatLock.show_id == show_id,
            SeatLock.seat_id.in_(seat_ids),
            SeatLock.lock_status == "ACTIVE",
            SeatLock.expires_at > now,
        )
        .order_by(SeatLock.seat_id.asc(), SeatLock.id.asc())
        .with_for_update()
        .all()
    )


def get_held_or_confirmed_booking_seats_for_update(db: Session, show_id: int, seat_ids: list[int]):
    if not seat_ids:
        return []
    return (
        db.query(BookingSeat)
        .filter(
            BookingSeat.show_id == show_id,
            BookingSeat.seat_id.in_(seat_ids),
            BookingSeat.seat_status.in_(["HELD", "CONFIRMED"]),
        )
        .with_for_update()
        .all()
    )


def create_booking(db: Session, booking: Booking):
    db.add(booking)
    db.flush()
    return booking


def create_booking_seat(db: Session, booking_seat: BookingSeat):
    db.add(booking_seat)
    db.flush()
    return booking_seat


def create_seat_lock(db: Session, seat_lock: SeatLock):
    db.add(seat_lock)
    db.flush()
    return seat_lock


def get_user_lock_rows_for_release(db: Session, show_id: int, user_id: int, lock_token: str | None = None, seat_ids: list[int] | None = None, now: datetime | None = None):
    now = now or utcnow()
    query = db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.user_id == user_id,
        SeatLock.lock_status == "ACTIVE",
    )
    if lock_token:
        query = query.filter(SeatLock.lock_token == lock_token)
    if seat_ids:
        query = query.filter(SeatLock.seat_id.in_(seat_ids))
    return query.with_for_update().all()


def get_booking_by_id(db: Session, booking_id: int):
    return db.query(Booking).filter(Booking.booking_id == booking_id).first()


def get_booking_by_id_for_user_for_update(db: Session, booking_id: int, user_id: int):
    return (
        db.query(Booking)
        .filter(Booking.booking_id == booking_id, Booking.user_id == user_id)
        .with_for_update()
        .first()
    )


def get_booking_by_id_for_update(db: Session, booking_id: int):
    return db.query(Booking).filter(Booking.booking_id == booking_id).with_for_update().first()


def get_booking_seats(db: Session, booking_id: int):
    return db.query(BookingSeat).filter(BookingSeat.booking_id == booking_id).order_by(BookingSeat.id.asc()).all()


def get_booking_seats_for_update(db: Session, booking_id: int):
    return (
        db.query(BookingSeat)
        .filter(BookingSeat.booking_id == booking_id)
        .order_by(BookingSeat.id.asc())
        .with_for_update()
        .all()
    )


def get_latest_payment_for_booking(db: Session, booking_id: int, for_update: bool = False):
    q = db.query(Payment).filter(Payment.booking_id == booking_id).order_by(desc(Payment.payment_id))
    if for_update:
        q = q.with_for_update()
    return q.first()


def get_payment_by_id_for_update(db: Session, payment_id: int):
    return db.query(Payment).filter(Payment.payment_id == payment_id).with_for_update().first()


def get_payment_by_provider_order_id(db: Session, provider_order_id: str):
    return db.query(Payment).filter(Payment.provider_order_id == provider_order_id).first()


def get_payment_by_provider_payment_id(db: Session, provider_payment_id: str):
    return db.query(Payment).filter(Payment.provider_payment_id == provider_payment_id).first()


def create_payment(db: Session, payment: Payment):
    db.add(payment)
    db.flush()
    return payment


def get_booking_by_lock_token_for_user(db: Session, lock_token: str, user_id: int):
    lock = (
        db.query(SeatLock)
        .filter(SeatLock.lock_token == lock_token, SeatLock.user_id == user_id)
        .order_by(desc(SeatLock.id))
        .first()
    )
    if not lock or not lock.booking_id:
        return None
    return db.query(Booking).filter(Booking.booking_id == lock.booking_id, Booking.user_id == user_id).first()


def create_ticket(db: Session, ticket: Ticket):
    db.add(ticket)
    db.flush()
    return ticket


def get_tickets_for_booking(db: Session, booking_id: int):
    return db.query(Ticket).filter(Ticket.booking_id == booking_id).all()


def list_bookings_for_user(db: Session, user_id: int):
    # returns (Booking, Show, Screen, Theatre, Movie)
    return (
        db.query(Booking, Show, Screen, Theatre, Movie)
        .join(Show, Booking.show_id == Show.show_id)
        .join(Screen, Show.screen_id == Screen.screen_id)
        .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
        .join(Movie, Show.movie_id == Movie.movie_id)
        .filter(Booking.user_id == user_id)
        .order_by(Booking.created_at.desc(), Booking.booking_id.desc())
        .all()
    )


def get_booking_detail_context_for_user(db: Session, booking_id: int, user_id: int):
    return (
        db.query(Booking, Show, Screen, Theatre, Movie)
        .join(Show, Booking.show_id == Show.show_id)
        .join(Screen, Show.screen_id == Screen.screen_id)
        .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
        .join(Movie, Show.movie_id == Movie.movie_id)
        .filter(Booking.booking_id == booking_id, Booking.user_id == user_id)
        .first()
    )


def get_ticket_by_booking_id(db: Session, booking_id: int):
    return db.query(Ticket).filter(Ticket.booking_id == booking_id).order_by(Ticket.ticket_id.asc()).first()


def get_ticket_by_qr_for_update(db: Session, qr_code_identifier: str):
    return db.query(Ticket).filter(Ticket.qr_code_identifier == qr_code_identifier).with_for_update().first()


def get_ticket_by_reference_for_update(db: Session, ticket_reference: str):
    return db.query(Ticket).filter(Ticket.ticket_reference == ticket_reference).with_for_update().first()


def get_ticket_detail_context(db: Session, booking_id: int):
    # (Booking, Show, Screen, Theatre, Movie)
    return get_booking_detail_context_by_booking_id(db, booking_id)


def get_booking_detail_context_by_booking_id(db: Session, booking_id: int):
    return (
        db.query(Booking, Show, Screen, Theatre, Movie)
        .join(Show, Booking.show_id == Show.show_id)
        .join(Screen, Show.screen_id == Screen.screen_id)
        .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
        .join(Movie, Show.movie_id == Movie.movie_id)
        .filter(Booking.booking_id == booking_id)
        .first()
    )
