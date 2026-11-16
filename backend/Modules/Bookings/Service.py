import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Bookings import Repository
from Modules.Bookings.Model import Booking, BookingSeat, Payment, SeatLock, Ticket
from Modules.Bookings.Payments import get_payment_provider
from Modules.Notifications import Service as NotificationService
from Modules.Screens import Repository as ScreenRepository


MAX_SEATS_PER_LOCK = 20
TAX_RATE = Decimal(os.getenv("BOOKING_TAX_RATE", "0.18"))      # 18% default illustrative; backend-calculated
CONVENIENCE_FEE_FLAT = Decimal(os.getenv("BOOKING_CONVENIENCE_FEE_FLAT", "20.00"))
CONVENIENCE_FEE_PER_SEAT = Decimal(os.getenv("BOOKING_CONVENIENCE_FEE_PER_SEAT", "0.00"))


def utcnow():
    return datetime.now(timezone.utc)


def _money(value: Decimal | float | int) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _money_decimal(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _generate_booking_reference() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"BK{ts}{secrets.token_hex(3).upper()}"


def _generate_ticket_ref() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"TK{ts}{secrets.token_hex(4).upper()}"


def _generate_qr_identifier() -> str:
    # Unique, non-guessable token; contains no sensitive user/payment information.
    return f"TQR_{secrets.token_urlsafe(24)}"


def _lock_ttl_minutes() -> int:
    try:
        minutes = int(os.getenv("SEAT_LOCK_TTL_MINUTES", "5"))
        return max(1, min(minutes, 30))
    except Exception:
        return 5


def _resolve_seat_price(screen, seat, category):
    # Server-side pricing only. Never trust frontend prices.
    if category is not None and category.price is not None:
        return Decimal(str(category.price)), category.category_name
    if screen.default_price is not None:
        return Decimal(str(screen.default_price)), None
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unable to determine server-side price for seat {seat.seat_name}",
    )


def _calculate_amounts(subtotal: Decimal, seat_count: int):
    subtotal = _money_decimal(subtotal)
    tax_amount = (subtotal * TAX_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    convenience_fee = (CONVENIENCE_FEE_FLAT + (CONVENIENCE_FEE_PER_SEAT * Decimal(seat_count))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = (subtotal + tax_amount + convenience_fee).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, tax_amount, convenience_fee, total


def _display_booking_status(db_status: str) -> str:
    # Preserve DB compatibility while exposing requested checkout states clearly.
    mapping = {
        "PAYMENT_PENDING": "PENDING_PAYMENT",
    }
    return mapping.get(db_status, db_status)


def _normalize_db_booking_status(status_str: str) -> str:
    mapping = {
        "PENDING_PAYMENT": "PAYMENT_PENDING",
    }
    return mapping.get(status_str, status_str)


def get_show_seat_availability(db: Session, token: str, show_id: int):
    user = AuthService.get_authenticated_user(db, token)
    show_ctx = Repository.get_show_with_screen(db, show_id)
    if not show_ctx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")

    show, screen, theatre = show_ctx
    try:
        Repository.expire_stale_locks(db, show_id=show_id)
        db.commit()
    except Exception:
        db.rollback()

    seat_rows = Repository.list_screen_seats_with_category(db, screen.screen_id)
    categories = ScreenRepository.list_categories(db, screen.screen_id)
    booked_ids = Repository.get_booked_or_held_seat_ids(db, show_id)
    active_locks = Repository.get_active_locks_for_show(db, show_id)
    lock_map = {lock.seat_id: lock for lock in active_locks}

    seats = []
    for seat, category in seat_rows:
        status_label = "AVAILABLE"
        if not seat.is_active:
            status_label = "INACTIVE"
        elif seat.seat_id in lock_map:
            lock = lock_map[seat.seat_id]
            status_label = "LOCKED_BY_YOU" if lock.user_id == user.id else "LOCKED"
        elif seat.seat_id in booked_ids:
            status_label = "BOOKED"

        cat_price = None
        if category and category.price is not None:
            cat_price = _money(category.price)
        elif screen.default_price is not None:
            cat_price = _money(screen.default_price)

        seats.append(
            {
                "seat_id": seat.seat_id,
                "seat_name": seat.seat_name,
                "row_number": seat.row_number,
                "column_number": seat.column_number,
                "category_id": seat.category_id,
                "category_name": category.category_name if category else None,
                "category_price": cat_price,
                "category_color": category.color if category else None,
                "is_active": bool(seat.is_active),
                "availability_status": status_label,
            }
        )

    return {
        "show_id": show.show_id,
        "screen_id": screen.screen_id,
        "theatre_id": theatre.theatre_id,
        "screen_name": screen.screen_name,
        "no_of_rows": screen.no_of_rows,
        "no_of_columns": screen.no_of_columns,
        "layout_config": screen.layout_config,
        "categories": categories,
        "seats": seats,
    }


def lock_seats(db: Session, token: str, show_id: int, payload):
    user = AuthService.get_authenticated_user(db, token)
    seat_ids = payload.seat_ids or []
    seen = set()
    normalized_ids = []
    for sid in seat_ids:
        if sid in seen:
            continue
        seen.add(sid)
        normalized_ids.append(sid)
    seat_ids = normalized_ids

    if not seat_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one seat must be selected")
    if len(seat_ids) > MAX_SEATS_PER_LOCK:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot lock more than {MAX_SEATS_PER_LOCK} seats at once")

    now = utcnow()
    expires_at = now + timedelta(minutes=_lock_ttl_minutes())
    lock_token = secrets.token_urlsafe(32)

    try:
        Repository.expire_stale_locks(db, show_id=show_id, now=now)

        show_ctx = Repository.get_show_with_screen(db, show_id)
        if not show_ctx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")
        show, screen, theatre = show_ctx

        show_start = datetime.combine(show.show_date, show.start_time, tzinfo=timezone.utc)
        if show_start <= now or str(show.status).lower() != "scheduled":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected show is not available for booking")
        if str(screen.status).upper() != "ACTIVE" or str(theatre.status).upper() != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected show is not available for booking")

        seat_rows = Repository.get_seats_with_category_for_update(db, seat_ids)
        found_ids = {seat.seat_id for seat, _ in seat_rows}
        missing = [sid for sid in seat_ids if sid not in found_ids]
        if missing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid seat(s): {missing}")

        for seat, _category in seat_rows:
            if seat.screen_id != show.screen_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Seat {seat.seat_id} does not belong to the selected show")
            if not seat.is_active:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Seat {seat.seat_name} is not active")

        active_locks = Repository.get_active_lock_rows_for_seats_for_update(db, show_id, seat_ids, now=now)
        for lock in active_locks:
            if lock.user_id != user.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Seat is already locked by another user (seat_id={lock.seat_id})")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Seat is already locked in your active session (seat_id={lock.seat_id})")

        held_or_booked = Repository.get_held_or_confirmed_booking_seats_for_update(db, show_id, seat_ids)
        if held_or_booked:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="One or more selected seats are already booked or held")

        subtotal = Decimal("0.00")
        lock_seat_payloads = []
        for seat, category in seat_rows:
            price, category_name = _resolve_seat_price(screen, seat, category)
            subtotal += price
            lock_seat_payloads.append((seat, category_name, price))

        subtotal, tax_amount, convenience_fee, total_amount = _calculate_amounts(subtotal, len(seat_ids))

        booking = Booking(
            booking_reference=_generate_booking_reference(),
            user_id=user.id,
            show_id=show.show_id,
            booking_status="PENDING",
            subtotal=subtotal,
            tax_amount=tax_amount,
            convenience_fee=convenience_fee,
            total_amount=total_amount,
            currency="INR",
            lock_expires_at=expires_at,
        )
        Repository.create_booking(db, booking)

        response_seats = []
        for seat, category_name, price in lock_seat_payloads:
            Repository.create_booking_seat(
                db,
                BookingSeat(
                    booking_id=booking.booking_id,
                    show_id=show.show_id,
                    seat_id=seat.seat_id,
                    user_id=user.id,
                    seat_name_snapshot=seat.seat_name,
                    category_name_snapshot=category_name,
                    seat_price=price,
                    seat_status="HELD",
                ),
            )
            Repository.create_seat_lock(
                db,
                SeatLock(
                    show_id=show.show_id,
                    seat_id=seat.seat_id,
                    user_id=user.id,
                    booking_id=booking.booking_id,
                    lock_token=lock_token,
                    locked_at=now,
                    expires_at=expires_at,
                    lock_status="ACTIVE",
                ),
            )
            response_seats.append(
                {
                    "seat_id": seat.seat_id,
                    "seat_name": seat.seat_name,
                    "category_name": category_name,
                    "price": _money(price),
                }
            )

        db.commit()
        expires_in = max(0, int((expires_at - utcnow()).total_seconds()))
        return {
            "show_id": show.show_id,
            "lock_token": lock_token,
            "lock_status": "ACTIVE",
            "locked_at": now,
            "expires_at": expires_at,
            "expires_in_seconds": expires_in,
            "seats": response_seats,
            "subtotal": _money(subtotal),
            "currency": "INR",
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Selected seats are no longer available")
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def release_seat_locks(db: Session, token: str, show_id: int, payload):
    user = AuthService.get_authenticated_user(db, token)
    now = utcnow()
    lock_token = payload.lock_token if payload else None
    seat_ids = payload.seat_ids if payload and payload.seat_ids else None

    try:
        Repository.expire_stale_locks(db, show_id=show_id, now=now)
        rows = Repository.get_user_lock_rows_for_release(
            db,
            show_id=show_id,
            user_id=user.id,
            lock_token=lock_token,
            seat_ids=seat_ids,
        )
        if (lock_token or seat_ids) and not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching active seat locks found for this user")

        released = 0
        booking_ids = set()
        for lock in rows:
            if lock.expires_at <= now:
                lock.lock_status = "EXPIRED"
            else:
                lock.lock_status = "RELEASED"
            lock.released_at = now
            released += 1
            if lock.booking_id:
                booking_ids.add(lock.booking_id)

        if booking_ids:
            held_seats = (
                db.query(BookingSeat)
                .filter(
                    BookingSeat.booking_id.in_(list(booking_ids)),
                    BookingSeat.user_id == user.id,
                    BookingSeat.show_id == show_id,
                    BookingSeat.seat_status == "HELD",
                )
                .with_for_update()
                .all()
            )
            for bs in held_seats:
                bs.seat_status = "RELEASED"

            bookings = db.query(Booking).filter(Booking.booking_id.in_(list(booking_ids)), Booking.user_id == user.id).with_for_update().all()
            for b in bookings:
                remaining_held = (
                    db.query(BookingSeat)
                    .filter(BookingSeat.booking_id == b.booking_id, BookingSeat.seat_status == "HELD")
                    .count()
                )
                if remaining_held == 0 and b.booking_status in ("PENDING", "PAYMENT_PENDING"):
                    b.booking_status = "CANCELLED"
                    b.cancelled_at = now
                    b.updated_at = now

        db.commit()
        return {
            "show_id": show_id,
            "released_count": released,
            "lock_token": lock_token,
            "status": "RELEASED",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def _require_ticket_booker(user):
    if user.role != "TICKET_BOOKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only ticket bookers can perform this action")


def _get_valid_user_lock_and_booking(db: Session, user, lock_token: str, for_update: bool = True):
    now = utcnow()
    locks = Repository.get_active_locks_by_token_for_user(db, lock_token, user.id, now=now, for_update=for_update)
    if not locks:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat lock is invalid, expired, or does not belong to you")
    booking_id = locks[0].booking_id
    if not booking_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No booking associated with this lock")
    booking = Repository.get_booking_by_id_for_update(db, booking_id) if for_update else Repository.get_booking_by_id(db, booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found for this lock")
    return locks, booking


def _recalculate_booking_amounts_from_seats(db: Session, booking: Booking):
    seats = Repository.get_booking_seats_for_update(db, booking.booking_id)
    if not seats:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking has no seats")
    subtotal = sum((Decimal(str(s.seat_price)) for s in seats), Decimal("0.00"))
    subtotal, tax, fee, total = _calculate_amounts(subtotal, len(seats))
    booking.subtotal = subtotal
    booking.tax_amount = tax
    booking.convenience_fee = fee
    booking.total_amount = total
    booking.updated_at = utcnow()
    return seats, subtotal, tax, fee, total


def get_booking_summary(db: Session, token: str, lock_token: str):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    try:
        Repository.expire_stale_locks(db)
        locks, booking = _get_valid_user_lock_and_booking(db, user, lock_token, for_update=True)
        show_ctx = Repository.get_show_context_for_booking(db, booking.show_id)
        if not show_ctx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")
        show, screen, theatre, movie = show_ctx
        seats, subtotal, tax, fee, total = _recalculate_booking_amounts_from_seats(db, booking)
        db.commit()
        return {
            "show_id": show.show_id,
            "movie_name": movie.movie_name,
            "theatre_name": theatre.name,
            "theatre_address": theatre.address,
            "theatre_city": theatre.city,
            "screen_name": screen.screen_name,
            "show_date": show.show_date,
            "start_time": show.start_time,
            "end_time": show.end_time,
            "lock_token": lock_token,
            "lock_expires_at": locks[0].expires_at,
            "seats": [
                {
                    "seat_id": s.seat_id,
                    "seat_name": s.seat_name_snapshot,
                    "category_name": s.category_name_snapshot,
                    "price": _money(s.seat_price),
                }
                for s in seats
            ],
            "ticket_subtotal": _money(subtotal),
            "tax_amount": _money(tax),
            "convenience_fee": _money(fee),
            "total_payable_amount": _money(total),
            "currency": booking.currency or "INR",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def _payment_to_info(payment: Payment, provider_is_sandbox: bool):
    return {
        "payment_id": payment.payment_id,
        "provider": payment.provider,
        "provider_order_id": payment.provider_order_id,
        "amount": _money(payment.amount),
        "currency": payment.currency,
        "payment_status": payment.payment_status,
        "is_sandbox": provider_is_sandbox,
    }


def _ensure_tickets_for_confirmed_booking(db: Session, booking: Booking):
    # One unique ticket per confirmed booking (idempotent; duplicate callbacks must not create duplicates)
    existing = Repository.get_tickets_for_booking(db, booking.booking_id)
    if existing:
        # Keep only primary ticket semantics; ensure cancelled bookings don't keep valid tickets
        if booking.booking_status == "CANCELLED":
            for t in existing:
                if t.ticket_status == "ISSUED":
                    t.ticket_status = "CANCELLED"
        elif booking.booking_status == "CONFIRMED":
            # Do not resurrect cancelled/used tickets on duplicate confirmation callbacks
            pass
        return existing

    if booking.booking_status != "CONFIRMED":
        return []

    t = Ticket(
        booking_id=booking.booking_id,
        user_id=booking.user_id,
        show_id=booking.show_id,
        ticket_reference=_generate_ticket_ref(),
        qr_code_identifier=_generate_qr_identifier(),
        ticket_status="ISSUED",
    )
    Repository.create_ticket(db, t)
    return [t]


def _confirm_booking_from_verified_payment(db: Session, booking: Booking, payment: Payment, now: datetime):
    if booking.booking_status == "CONFIRMED" and payment.payment_status in ("CAPTURED", "AUTHORIZED"):
        _ensure_tickets_for_confirmed_booking(db, booking)
        return booking

    # Convert locks and held seats into confirmed records
    seats = Repository.get_booking_seats_for_update(db, booking.booking_id)
    for s in seats:
        if s.seat_status == "HELD":
            s.seat_status = "CONFIRMED"
    locks = db.query(SeatLock).filter(SeatLock.booking_id == booking.booking_id).with_for_update().all()
    for lock in locks:
        if lock.lock_status == "ACTIVE":
            lock.lock_status = "CONVERTED"
            lock.released_at = now

    booking.booking_status = "CONFIRMED"
    booking.confirmed_at = booking.confirmed_at or now
    booking.updated_at = now
    payment.payment_status = "CAPTURED"
    payment.updated_at = now
    _ensure_tickets_for_confirmed_booking(db, booking)
    _notify(db, user_id=booking.user_id, type="PAYMENT_SUCCESS", title="Payment successful", message=f"Payment received for booking {booking.booking_reference}.", related_booking_id=booking.booking_id)
    _notify(db, user_id=booking.user_id, type="BOOKING_CONFIRMED", title="Booking confirmed", message=f"Your booking {booking.booking_reference} is confirmed. Your ticket is ready.", related_booking_id=booking.booking_id)
    return booking


def checkout_create_booking(db: Session, token: str, payload):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    provider = get_payment_provider()
    now = utcnow()

    try:
        Repository.expire_stale_locks(db)
        locks, booking = _get_valid_user_lock_and_booking(db, user, payload.lock_token, for_update=True)

        # If booking already confirmed, return existing payment/status (idempotent-safe)
        latest_payment = Repository.get_latest_payment_for_booking(db, booking.booking_id, for_update=True)
        if booking.booking_status == "CONFIRMED":
            if latest_payment is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirmed booking has no payment record")
            seats = Repository.get_booking_seats(db, booking.booking_id)
            return {
                "booking_id": booking.booking_id,
                "booking_reference": booking.booking_reference,
                "booking_status": _display_booking_status(booking.booking_status),
                "user_id": booking.user_id,
                "show_id": booking.show_id,
                "lock_token": payload.lock_token,
                "ticket_subtotal": _money(booking.subtotal),
                "tax_amount": _money(booking.tax_amount),
                "convenience_fee": _money(booking.convenience_fee),
                "total_payable_amount": _money(booking.total_amount),
                "currency": booking.currency,
                "seats": [{"seat_id": s.seat_id, "seat_name": s.seat_name_snapshot, "category_name": s.category_name_snapshot, "price": _money(s.seat_price)} for s in seats],
                "payment": _payment_to_info(latest_payment, provider.is_sandbox),
            }

        # Re-validate show/seat availability and ownership/locks under transaction
        show_ctx = Repository.get_show_with_screen(db, booking.show_id)
        if not show_ctx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")
        show, screen, theatre = show_ctx
        show_start = datetime.combine(show.show_date, show.start_time, tzinfo=timezone.utc)
        if show_start <= now or str(show.status).lower() != "scheduled":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Show is no longer available for booking")

        seat_ids = [l.seat_id for l in locks]
        # Ensure active locks still valid and belong to same booking/user
        for lock in locks:
            if lock.booking_id != booking.booking_id or lock.user_id != user.id or lock.lock_status != "ACTIVE" or lock.expires_at <= now:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat lock is invalid or expired")

        # Revalidate seat availability again (no conflicting held/confirmed records outside this booking)
        conflicts = (
            db.query(BookingSeat)
            .filter(
                BookingSeat.show_id == booking.show_id,
                BookingSeat.seat_id.in_(seat_ids),
                BookingSeat.seat_status.in_(["HELD", "CONFIRMED"]),
                BookingSeat.booking_id != booking.booking_id,
            )
            .with_for_update()
            .all()
        )
        if conflicts:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Selected seats are no longer available")

        seats, subtotal, tax, fee, total = _recalculate_booking_amounts_from_seats(db, booking)

        # Move booking to pending payment state
        booking.booking_status = "PAYMENT_PENDING"
        booking.lock_expires_at = locks[0].expires_at
        booking.updated_at = now

        # Reuse existing pending/initiated payment if present (idempotent checkout initiation)
        payment = Repository.get_latest_payment_for_booking(db, booking.booking_id, for_update=True)
        reusable_statuses = {"INITIATED", "PENDING", "FAILED"}
        if payment and payment.payment_status in reusable_statuses and Decimal(str(payment.amount)) == total and payment.currency == (booking.currency or "INR"):
            # keep existing provider order for retry/resume
            if not payment.provider_order_id:
                order = provider.create_order(
                    booking_reference=booking.booking_reference,
                    amount=total,
                    currency=booking.currency or "INR",
                    notes={"booking_id": booking.booking_id, "user_id": booking.user_id, "sandbox": provider.is_sandbox},
                )
                payment.provider = order.provider
                payment.provider_order_id = order.provider_order_id
                payment.metadata_json = order.metadata
            payment.payment_status = "INITIATED"
            payment.failure_reason = None
            payment.updated_at = now
        elif payment and payment.payment_status in ("CAPTURED", "AUTHORIZED"):
            # should have been confirmed earlier; confirm now idempotently
            _confirm_booking_from_verified_payment(db, booking, payment, now)
        else:
            order = provider.create_order(
                booking_reference=booking.booking_reference,
                amount=total,
                currency=booking.currency or "INR",
                notes={"booking_id": booking.booking_id, "user_id": booking.user_id, "sandbox": provider.is_sandbox},
            )
            payment = Payment(
                booking_id=booking.booking_id,
                user_id=booking.user_id,
                provider=order.provider,
                provider_order_id=order.provider_order_id,
                provider_payment_id=None,
                amount=total,
                currency=booking.currency or "INR",
                payment_status="INITIATED",
                idempotency_key=f"booking:{booking.booking_id}",
                metadata_json=order.metadata,
            )
            Repository.create_payment(db, payment)

        db.commit()
        return {
            "booking_id": booking.booking_id,
            "booking_reference": booking.booking_reference,
            "booking_status": _display_booking_status(booking.booking_status),
            "user_id": booking.user_id,
            "show_id": booking.show_id,
            "lock_token": payload.lock_token,
            "ticket_subtotal": _money(subtotal),
            "tax_amount": _money(tax),
            "convenience_fee": _money(fee),
            "total_payable_amount": _money(total),
            "currency": booking.currency or "INR",
            "seats": [{"seat_id": s.seat_id, "seat_name": s.seat_name_snapshot, "category_name": s.category_name_snapshot, "price": _money(s.seat_price)} for s in seats],
            "payment": _payment_to_info(payment, provider.is_sandbox),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def get_booking_status(db: Session, token: str, booking_id: int):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    try:
        Repository.expire_stale_locks(db)
        booking = Repository.get_booking_by_id_for_user_for_update(db, booking_id, user.id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        seats = Repository.get_booking_seats(db, booking.booking_id)
        payment = Repository.get_latest_payment_for_booking(db, booking.booking_id)
        provider = get_payment_provider()
        db.commit()
        return {
            "booking_id": booking.booking_id,
            "booking_reference": booking.booking_reference,
            "booking_status": _display_booking_status(booking.booking_status),
            "show_id": booking.show_id,
            "ticket_subtotal": _money(booking.subtotal),
            "tax_amount": _money(booking.tax_amount),
            "convenience_fee": _money(booking.convenience_fee),
            "total_payable_amount": _money(booking.total_amount),
            "currency": booking.currency or "INR",
            "lock_expires_at": booking.lock_expires_at,
            "confirmed_at": booking.confirmed_at,
            "payment": _payment_to_info(payment, provider.is_sandbox) if payment else None,
            "seats": [{"seat_id": s.seat_id, "seat_name": s.seat_name_snapshot, "category_name": s.category_name_snapshot, "price": _money(s.seat_price)} for s in seats],
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def verify_payment(db: Session, token: str, booking_id: int, payload):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    provider = get_payment_provider()
    now = utcnow()
    try:
        Repository.expire_stale_locks(db)
        booking = Repository.get_booking_by_id_for_user_for_update(db, booking_id, user.id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        payment = Repository.get_latest_payment_for_booking(db, booking.booking_id, for_update=True)
        if not payment or not payment.provider_order_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment order not found for this booking")

        # Idempotency / duplicate protection
        if booking.booking_status == "CONFIRMED" and payment.payment_status in ("CAPTURED", "AUTHORIZED"):
            db.commit()
            return {
                "booking_id": booking.booking_id,
                "booking_reference": booking.booking_reference,
                "booking_status": _display_booking_status(booking.booking_status),
                "payment_status": payment.payment_status,
                "payment_id": payment.payment_id,
                "provider": payment.provider,
                "provider_order_id": payment.provider_order_id,
                "provider_payment_id": payment.provider_payment_id,
                "amount": _money(payment.amount),
                "currency": payment.currency,
                "is_sandbox": provider.is_sandbox,
                "message": "Payment already verified and booking confirmed.",
            }

        if booking.lock_expires_at and booking.lock_expires_at <= now:
            booking.booking_status = "EXPIRED"
            payment.payment_status = "FAILED"
            payment.failure_reason = "Seat lock expired before payment verification"
            payment.updated_at = now
            booking.updated_at = now
            db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat lock expired. Please select seats again.")

        # Duplicate provider payment id protection
        existing_pp = Repository.get_payment_by_provider_payment_id(db, payload.provider_payment_id)
        if existing_pp and existing_pp.payment_id != payment.payment_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate payment identifier detected")

        verified = provider.verify_payment_signature(
            provider_order_id=payment.provider_order_id,
            provider_payment_id=payload.provider_payment_id,
            signature=payload.signature,
        )
        if not verified:
            payment.payment_status = "FAILED"
            booking.booking_status = "FAILED"
            payment.failure_reason = "Invalid payment signature"
            payment.provider_payment_id = payload.provider_payment_id
            payment.updated_at = now
            booking.updated_at = now
            _notify(db, user_id=booking.user_id, type="PAYMENT_FAILED", title="Payment failed", message=f"Payment verification failed for booking {booking.booking_reference}. Please retry if eligible.", related_booking_id=booking.booking_id)
            db.commit()
            return {
                "booking_id": booking.booking_id,
                "booking_reference": booking.booking_reference,
                "booking_status": _display_booking_status(booking.booking_status),
                "payment_status": payment.payment_status,
                "payment_id": payment.payment_id,
                "provider": payment.provider,
                "provider_order_id": payment.provider_order_id,
                "provider_payment_id": payment.provider_payment_id,
                "amount": _money(payment.amount),
                "currency": payment.currency,
                "is_sandbox": provider.is_sandbox,
                "message": "Payment signature verification failed.",
            }

        # Mark payment verified evidence received; confirm booking transactionally
        payment.provider_payment_id = payload.provider_payment_id
        payment.payment_status = "AUTHORIZED"
        payment.updated_at = now
        _confirm_booking_from_verified_payment(db, booking, payment, now)
        db.commit()
        return {
            "booking_id": booking.booking_id,
            "booking_reference": booking.booking_reference,
            "booking_status": _display_booking_status(booking.booking_status),
            "payment_status": payment.payment_status,
            "payment_id": payment.payment_id,
            "provider": payment.provider,
            "provider_order_id": payment.provider_order_id,
            "provider_payment_id": payment.provider_payment_id,
            "amount": _money(payment.amount),
            "currency": payment.currency,
            "is_sandbox": provider.is_sandbox,
            "message": "Payment verified and booking confirmed (sandbox/test verification).",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def handle_payment_webhook(db: Session, payload_body: bytes, signature: str | None):
    provider = get_payment_provider()
    now = utcnow()
    try:
        if not provider.verify_webhook_signature(payload_body=payload_body, signature=signature):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

        event = provider.parse_webhook_event(payload_body=payload_body)
        # Expected sandbox/webhook payload shape (adapter can be extended for real providers):
        # { "event": "payment.captured|payment.failed", "booking_id": ..., "provider_order_id": "...", "provider_payment_id": "...", "status": "..." }
        booking_id = event.get("booking_id")
        provider_order_id = event.get("provider_order_id")
        provider_payment_id = event.get("provider_payment_id")
        event_type = (event.get("event") or event.get("status") or "").lower()

        payment = None
        if provider_order_id:
            payment = Repository.get_payment_by_provider_order_id(db, provider_order_id)
        if not payment and booking_id:
            payment = Repository.get_latest_payment_for_booking(db, int(booking_id), for_update=True)
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found for webhook")

        booking = Repository.get_booking_by_id_for_update(db, payment.booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found for webhook")

        # Duplicate webhook protection / idempotency
        if provider_payment_id:
            existing_pp = Repository.get_payment_by_provider_payment_id(db, provider_payment_id)
            if existing_pp and existing_pp.payment_id != payment.payment_id:
                db.commit()
                return {"status": "ignored", "reason": "duplicate_provider_payment_id"}
            if payment.provider_payment_id == provider_payment_id and payment.payment_status in ("CAPTURED", "AUTHORIZED") and booking.booking_status == "CONFIRMED":
                db.commit()
                return {"status": "ok", "idempotent": True, "booking_status": _display_booking_status(booking.booking_status)}

        if "fail" in event_type:
            payment.payment_status = "FAILED"
            payment.failure_reason = event.get("reason") or "Payment failed (webhook)"
            if provider_payment_id:
                payment.provider_payment_id = provider_payment_id
            if booking.booking_status != "CONFIRMED":
                booking.booking_status = "FAILED"
            payment.updated_at = now
            booking.updated_at = now
            _notify(db, user_id=booking.user_id, type="PAYMENT_FAILED", title="Payment failed", message=f"Payment failed for booking {booking.booking_reference}.", related_booking_id=booking.booking_id)
            db.commit()
            return {"status": "ok", "booking_status": _display_booking_status(booking.booking_status), "payment_status": payment.payment_status}

        # Treat captured/authorized/success events as verified evidence (signature already verified above)
        if any(k in event_type for k in ["captured", "authorized", "success", "paid"]) or event.get("verified") is True:
            if provider_payment_id:
                payment.provider_payment_id = provider_payment_id
            payment.payment_status = "AUTHORIZED" if "authorized" in event_type else "CAPTURED"
            payment.updated_at = now
            _confirm_booking_from_verified_payment(db, booking, payment, now)
            db.commit()
            return {"status": "ok", "idempotent": False, "booking_status": _display_booking_status(booking.booking_status), "payment_status": payment.payment_status}

        db.commit()
        return {"status": "ignored", "reason": "unhandled_event"}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def retry_payment(db: Session, token: str, booking_id: int):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    provider = get_payment_provider()
    now = utcnow()
    try:
        Repository.expire_stale_locks(db)
        booking = Repository.get_booking_by_id_for_user_for_update(db, booking_id, user.id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        if booking.booking_status == "CONFIRMED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is already confirmed")
        if booking.booking_status in ("EXPIRED", "CANCELLED"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking cannot be retried in its current state")
        if booking.lock_expires_at and booking.lock_expires_at <= now:
            booking.booking_status = "EXPIRED"
            booking.updated_at = now
            db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat lock expired. Please select seats again.")

        payment = Repository.get_latest_payment_for_booking(db, booking.booking_id, for_update=True)
        seats = Repository.get_booking_seats(db, booking.booking_id)
        if not seats:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking has no seats")

        # Recalculate amounts server-side for retry consistency
        subtotal = sum((Decimal(str(s.seat_price)) for s in seats), Decimal("0.00"))
        subtotal, tax, fee, total = _calculate_amounts(subtotal, len(seats))
        booking.subtotal, booking.tax_amount, booking.convenience_fee, booking.total_amount = subtotal, tax, fee, total
        booking.booking_status = "PAYMENT_PENDING"
        booking.updated_at = now

        if not payment or payment.payment_status in ("CAPTURED", "AUTHORIZED"):
            order = provider.create_order(
                booking_reference=booking.booking_reference,
                amount=total,
                currency=booking.currency or "INR",
                notes={"booking_id": booking.booking_id, "user_id": booking.user_id, "retry": True, "sandbox": provider.is_sandbox},
            )
            payment = Payment(
                booking_id=booking.booking_id,
                user_id=booking.user_id,
                provider=order.provider,
                provider_order_id=order.provider_order_id,
                amount=total,
                currency=booking.currency or "INR",
                payment_status="INITIATED",
                idempotency_key=f"booking:{booking.booking_id}:retry:{secrets.token_hex(4)}",
                metadata_json=order.metadata,
            )
            Repository.create_payment(db, payment)
        else:
            # Reuse order when possible; generate new order if missing
            if not payment.provider_order_id:
                order = provider.create_order(
                    booking_reference=booking.booking_reference,
                    amount=total,
                    currency=booking.currency or "INR",
                    notes={"booking_id": booking.booking_id, "user_id": booking.user_id, "retry": True, "sandbox": provider.is_sandbox},
                )
                payment.provider_order_id = order.provider_order_id
                payment.provider = order.provider
                payment.metadata_json = order.metadata
            payment.amount = total
            payment.payment_status = "INITIATED"
            payment.failure_reason = None
            payment.updated_at = now

        db.commit()
        return {
            "booking_id": booking.booking_id,
            "booking_reference": booking.booking_reference,
            "booking_status": _display_booking_status(booking.booking_status),
            "payment_status": payment.payment_status,
            "payment_id": payment.payment_id,
            "provider": payment.provider,
            "provider_order_id": payment.provider_order_id,
            "provider_payment_id": payment.provider_payment_id,
            "amount": _money(payment.amount),
            "currency": payment.currency,
            "is_sandbox": provider.is_sandbox,
            "message": "Payment retry initialized (sandbox/test).",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def get_sandbox_payment_helpers(db: Session, token: str, booking_id: int):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    provider = get_payment_provider()
    if not getattr(provider, "is_sandbox", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sandbox helpers are only available in sandbox/test mode")

    booking = Repository.get_booking_by_id_for_user_for_update(db, booking_id, user.id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    payment = Repository.get_latest_payment_for_booking(db, booking.booking_id)
    if not payment or not payment.provider_order_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No initiated payment order found for this booking")

    sandbox_payment_id = f"sandbox_pay_{secrets.token_hex(6)}"
    sandbox_signature = provider.make_client_signature(payment.provider_order_id, sandbox_payment_id)  # type: ignore[attr-defined]
    db.rollback()  # read-only helper
    return {
        "provider": payment.provider,
        "is_sandbox": True,
        "provider_order_id": payment.provider_order_id,
        "sandbox_payment_id": sandbox_payment_id,
        "sandbox_signature": sandbox_signature,
        "webhook_signature_for_event": None,
        "warning": "Sandbox/test helper only. This does not represent a real successful transaction and does not confirm booking by itself.",
    }



def _notify(db: Session, *, user_id: int, type: str, title: str, message: str, related_booking_id: int | None = None):
    try:
        NotificationService.create_user_notification(
            db,
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            related_booking_id=related_booking_id,
            commit=False,
        )
    except Exception:
        # Notifications must not break core booking/payment flows
        pass


# -------------------- Stage 7: Tickets & My Bookings --------------------

def _seat_numbers_from_booking_seats(seats):
    return [s.seat_name_snapshot for s in seats]


def _effective_ticket_status(booking: Booking, ticket: Ticket | None):
    if ticket is None:
        return None
    # Cancelled/failed bookings must not have valid tickets
    if booking.booking_status in ("CANCELLED", "FAILED", "EXPIRED"):
        return "CANCELLED" if ticket.ticket_status in ("ISSUED", "USED") else ticket.ticket_status
    if booking.booking_status != "CONFIRMED":
        return "CANCELLED" if ticket.ticket_status == "ISSUED" else ticket.ticket_status
    # Expire issued tickets for past shows (data consistency on read)
    return ticket.ticket_status


def _sync_ticket_with_booking_state(booking: Booking, ticket: Ticket | None, show=None, now: datetime | None = None):
    if ticket is None:
        return None
    now = now or utcnow()
    if booking.booking_status in ("CANCELLED", "FAILED", "EXPIRED"):
        if ticket.ticket_status == "ISSUED":
            ticket.ticket_status = "CANCELLED"
    elif booking.booking_status == "CONFIRMED" and show is not None:
        show_dt = datetime.combine(show.show_date, show.end_time or show.start_time, tzinfo=timezone.utc)
        if show_dt < now and ticket.ticket_status == "ISSUED":
            ticket.ticket_status = "EXPIRED"
    return ticket


def _build_ticket_info(db: Session, booking: Booking, show, screen, theatre, movie, ticket: Ticket | None = None):
    seats = Repository.get_booking_seats(db, booking.booking_id)
    if ticket is None:
        ticket = Repository.get_ticket_by_booking_id(db, booking.booking_id)
    _sync_ticket_with_booking_state(booking, ticket, show)
    if ticket is None:
        return None
    seat_numbers = _seat_numbers_from_booking_seats(seats)
    show_time = show.start_time
    poster = getattr(movie, "poster_path", None) or getattr(movie, "poster_url", None) or getattr(movie, "image_url", None)
    return {
        "ticket_id": ticket.ticket_id,
        "ticket_reference": ticket.ticket_reference,
        "qr_code_identifier": ticket.qr_code_identifier,
        "ticket_status": ticket.ticket_status,
        "issued_at": ticket.issued_at,
        "booking_id": booking.booking_id,
        "booking_reference": booking.booking_reference,
        "movie_name": getattr(movie, "movie_name", None),
        "movie_poster": poster,
        "theatre_name": getattr(theatre, "name", None),
        "theatre_address": getattr(theatre, "address", None),
        "screen_name": getattr(screen, "screen_name", None),
        "show_date": show.show_date,
        "show_time": show_time,
        "seat_numbers": seat_numbers,
        "total_amount": _money(booking.total_amount),
        "currency": booking.currency or "INR",
        "booking_confirmation_status": _display_booking_status(booking.booking_status),
    }


def _booking_list_item(db: Session, booking, show, screen, theatre, movie):
    seats = Repository.get_booking_seats(db, booking.booking_id)
    ticket = Repository.get_ticket_by_booking_id(db, booking.booking_id)
    _sync_ticket_with_booking_state(booking, ticket, show)
    latest_payment = Repository.get_latest_payment_for_booking(db, booking.booking_id)
    poster = getattr(movie, "poster_path", None) or getattr(movie, "poster_url", None) or getattr(movie, "image_url", None)
    refund_status = None
    if latest_payment and latest_payment.payment_status == "REFUNDED":
        refund_status = "REFUNDED"
    elif booking.booking_status == "CANCELLED" and latest_payment and latest_payment.payment_status == "CAPTURED":
        refund_status = "PENDING_OR_NOT_APPLICABLE"
    return {
        "booking_id": booking.booking_id,
        "booking_reference": booking.booking_reference,
        "booking_status": _display_booking_status(booking.booking_status),
        "movie_name": getattr(movie, "movie_name", None),
        "movie_poster": poster,
        "theatre_name": getattr(theatre, "name", None),
        "screen_name": getattr(screen, "screen_name", None),
        "show_date": show.show_date,
        "show_time": show.start_time,
        "seat_numbers": _seat_numbers_from_booking_seats(seats),
        "total_amount": _money(booking.total_amount),
        "currency": booking.currency or "INR",
        "booking_date": booking.created_at,
        "created_at": booking.created_at,
        "ticket_status": ticket.ticket_status if ticket else None,
        "has_ticket": bool(ticket and booking.booking_status == "CONFIRMED" and ticket.ticket_status in ("ISSUED", "USED", "EXPIRED")),
        "refund_status": refund_status,
    }


def list_my_bookings(db: Session, token: str):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    try:
        Repository.expire_stale_locks(db)
        rows = Repository.list_bookings_for_user(db, user.id)
        now = utcnow()
        upcoming, past, cancelled = [], [], []
        for booking, show, screen, theatre, movie in rows:
            item = _booking_list_item(db, booking, show, screen, theatre, movie)
            show_dt = datetime.combine(show.show_date, show.start_time, tzinfo=timezone.utc)
            if booking.booking_status in ("CANCELLED", "FAILED", "EXPIRED") and booking.booking_status != "CONFIRMED":
                cancelled.append(item)
            elif booking.booking_status == "CONFIRMED":
                if show_dt >= now:
                    upcoming.append(item)
                else:
                    # completed/past show (including used/expired ticket states)
                    past.append(item)
            else:
                # pending/other non-confirmed treated as upcoming-like only if future, else past-ish; exclude from confirmed lists except clarity
                if show_dt >= now:
                    upcoming.append(item)
                else:
                    past.append(item)
        db.commit()
        return {"upcoming": upcoming, "past": past, "cancelled": cancelled}
    except Exception:
        db.rollback()
        raise


def get_booking_details_for_owner(db: Session, token: str, booking_id: int):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    try:
        Repository.expire_stale_locks(db)
        ctx = Repository.get_booking_detail_context_for_user(db, booking_id, user.id)
        if not ctx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        booking, show, screen, theatre, movie = ctx
        seats = Repository.get_booking_seats(db, booking.booking_id)
        latest_payment = Repository.get_latest_payment_for_booking(db, booking.booking_id)
        ticket = Repository.get_ticket_by_booking_id(db, booking.booking_id)
        _sync_ticket_with_booking_state(booking, ticket, show)
        db.flush()
        poster = getattr(movie, "poster_path", None) or getattr(movie, "poster_url", None) or getattr(movie, "image_url", None)
        refund_status = None
        if latest_payment and latest_payment.payment_status == "REFUNDED":
            refund_status = "REFUNDED"
        ticket_info = _build_ticket_info(db, booking, show, screen, theatre, movie, ticket) if (ticket and booking.booking_status == "CONFIRMED") else None
        res = {
            "booking_id": booking.booking_id,
            "booking_reference": booking.booking_reference,
            "booking_status": _display_booking_status(booking.booking_status),
            "booking_date": booking.created_at,
            "movie_name": getattr(movie, "movie_name", None),
            "movie_poster": poster,
            "theatre_name": getattr(theatre, "name", None),
            "theatre_address": getattr(theatre, "address", None),
            "theatre_city": getattr(theatre, "city", None),
            "screen_name": getattr(screen, "screen_name", None),
            "show_date": show.show_date,
            "show_time": show.start_time,
            "start_time": show.start_time,
            "end_time": show.end_time,
            "seats": [{"seat_id": s.seat_id, "seat_name": s.seat_name_snapshot, "category_name": s.category_name_snapshot, "price": _money(s.seat_price)} for s in seats],
            "seat_numbers": _seat_numbers_from_booking_seats(seats),
            "ticket_subtotal": _money(booking.subtotal),
            "tax_amount": _money(booking.tax_amount),
            "convenience_fee": _money(booking.convenience_fee),
            "total_amount": _money(booking.total_amount),
            "currency": booking.currency or "INR",
            "payment_status": latest_payment.payment_status if latest_payment else None,
            "refund_status": refund_status,
            "ticket": ticket_info,
        }
        db.commit()
        return res
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def get_or_generate_ticket_for_owner(db: Session, token: str, booking_id: int):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    try:
        ctx = Repository.get_booking_detail_context_for_user(db, booking_id, user.id)
        if not ctx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        booking, show, screen, theatre, movie = ctx
        if booking.booking_status != "CONFIRMED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid tickets are only available for confirmed bookings")
        ticket = Repository.get_ticket_by_booking_id(db, booking.booking_id)
        if not ticket:
            _ensure_tickets_for_confirmed_booking(db, booking)
            ticket = Repository.get_ticket_by_booking_id(db, booking.booking_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to generate ticket")
        _sync_ticket_with_booking_state(booking, ticket, show)
        if ticket.ticket_status == "CANCELLED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticket is not valid for this booking")
        info = _build_ticket_info(db, booking, show, screen, theatre, movie, ticket)
        db.commit()
        return {"booking_id": booking.booking_id, "booking_reference": booking.booking_reference, "ticket": info}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def get_ticket_download_data(db: Session, token: str, booking_id: int):
    # Same as ticket payload but intended for client-side PDF/download generation
    return get_or_generate_ticket_for_owner(db, token, booking_id)


def verify_ticket(db: Session, token: str, payload):
    """
    Ticket verification endpoint suitable for future theatre-side scanning.
    - Authenticated operation: allowed for ADMIN/THEATRE_OWNER, or TICKET_BOOKER verifying own ticket (non-redeeming).
    - Validity requires confirmed booking, issued/usable ticket, matching show context, and not cancelled/expired/invalid.
    - Scanning QR alone is not proof: we verify authenticity and booking/ticket state server-side.
    - Safe redemption/check-in (redeem=true): marks ISSUED ticket as USED atomically; requires authorized staff role.
    """
    verifier = AuthService.get_authenticated_user(db, token)
    qr = (payload.qr_code_identifier or "").strip() or None
    tref = (payload.ticket_reference or "").strip() or None
    redeem = bool(payload.redeem)
    if not qr and not tref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide qr_code_identifier or ticket_reference")

    staff_roles = {"ADMIN", "THEATRE_OWNER"}
    try:
        # Lookup with lock for redemption safety
        if qr:
            ticket = Repository.get_ticket_by_qr_for_update(db, qr)
        else:
            ticket = Repository.get_ticket_by_reference_for_update(db, tref)

        if not ticket:
            db.rollback()
            return {"valid": False, "status": "NOT_FOUND", "message": "Ticket not found or invalid", "redeemed": False, "seat_numbers": []}

        ctx = Repository.get_booking_detail_context_by_booking_id(db, ticket.booking_id)
        if not ctx:
            db.rollback()
            return {"valid": False, "status": "INVALID", "message": "Associated booking not found", "redeemed": False, "seat_numbers": []}
        booking, show, screen, theatre, movie = ctx
        seats = Repository.get_booking_seats(db, booking.booking_id)
        seat_numbers = _seat_numbers_from_booking_seats(seats)
        _sync_ticket_with_booking_state(booking, ticket, show)

        base = {
            "ticket_reference": ticket.ticket_reference,
            "booking_reference": booking.booking_reference,
            "show_date": show.show_date,
            "show_time": show.start_time,
            "seat_numbers": seat_numbers,
            "movie_name": getattr(movie, "movie_name", None),
            "theatre_name": getattr(theatre, "name", None),
            "screen_name": getattr(screen, "screen_name", None),
        }

        # Authorization: staff can verify/redeem; ticket owner can only verify (no redeem)
        if verifier.role not in staff_roles:
            if verifier.id != booking.user_id:
                db.rollback()
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to verify this ticket")
            if redeem:
                db.rollback()
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only authorized theatre staff can redeem/check-in tickets")

        if booking.booking_status != "CONFIRMED":
            db.commit()
            return {**base, "valid": False, "status": "BOOKING_NOT_CONFIRMED", "message": "Booking is not confirmed", "redeemed": False}

        if ticket.ticket_status == "CANCELLED":
            db.commit()
            return {**base, "valid": False, "status": "CANCELLED", "message": "Ticket has been cancelled", "redeemed": False}
        if ticket.ticket_status == "EXPIRED":
            db.commit()
            return {**base, "valid": False, "status": "EXPIRED", "message": "Ticket has expired", "redeemed": False}
        if ticket.ticket_status == "USED":
            db.commit()
            return {**base, "valid": False, "status": "ALREADY_USED", "message": "Ticket has already been redeemed/checked in", "redeemed": False}
        if ticket.ticket_status != "ISSUED":
            db.commit()
            return {**base, "valid": False, "status": "INVALID", "message": "Ticket is not valid", "redeemed": False}

        # Optional: disallow check-in far outside show window? keep simple and safe - allow staff redemption when issued/confirmed
        if redeem:
            ticket.ticket_status = "USED"
            db.commit()
            return {**base, "valid": True, "status": "REDEEMED", "message": "Ticket verified and checked in successfully", "redeemed": True}

        db.commit()
        return {**base, "valid": True, "status": "VALID", "message": "Ticket is authentic and valid", "redeemed": False}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
