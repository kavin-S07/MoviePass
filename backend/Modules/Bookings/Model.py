from datetime import datetime, timezone
import secrets

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from config.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def generate_lock_token() -> str:
    return secrets.token_urlsafe(32)


class Booking(Base):
    __tablename__ = "bookings"

    booking_id = Column(BigInteger, Identity(always=True), primary_key=True)
    booking_reference = Column(String(40), nullable=False, unique=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    show_id = Column(BigInteger, ForeignKey("shows.show_id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_status = Column(String(30), nullable=False, default="PENDING", server_default="PENDING", index=True)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    convenience_fee = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    total_amount = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    currency = Column(String(10), nullable=False, default="INR", server_default="INR")
    lock_expires_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint(
            "booking_status IN ('PENDING','PAYMENT_PENDING','CONFIRMED','CANCELLED','FAILED','EXPIRED')",
            name="ck_bookings_status",
        ),
        CheckConstraint(
            "subtotal >= 0 AND tax_amount >= 0 AND convenience_fee >= 0 AND total_amount >= 0",
            name="ck_bookings_amounts_non_negative",
        ),
        Index("ix_bookings_user_created", "user_id", "created_at"),
    )


class SeatLock(Base):
    __tablename__ = "seat_locks"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    show_id = Column(BigInteger, ForeignKey("shows.show_id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id = Column(BigInteger, ForeignKey("seats.seat_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id", ondelete="SET NULL"), nullable=True, index=True)
    lock_token = Column(String(64), nullable=False, index=True, default=generate_lock_token)
    locked_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    lock_status = Column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")

    __table_args__ = (
        CheckConstraint(
            "lock_status IN ('ACTIVE','RELEASED','EXPIRED','CONVERTED')",
            name="ck_seat_locks_status",
        ),
        CheckConstraint("expires_at > locked_at", name="ck_seat_locks_expiry"),
        Index("ix_seat_locks_status_expires", "lock_status", "expires_at"),
        Index("ix_seat_locks_show_status", "show_id", "lock_status"),
        Index(
            "uq_seat_locks_active_show_seat",
            "show_id",
            "seat_id",
            unique=True,
            postgresql_where=text("lock_status = 'ACTIVE'"),
            sqlite_where=text("lock_status = 'ACTIVE'"),
        ),
    )


class BookingSeat(Base):
    __tablename__ = "booking_seats"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id", ondelete="CASCADE"), nullable=False, index=True)
    show_id = Column(BigInteger, ForeignKey("shows.show_id", ondelete="RESTRICT"), nullable=False, index=True)
    seat_id = Column(BigInteger, ForeignKey("seats.seat_id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    seat_name_snapshot = Column(String(20), nullable=False)
    category_name_snapshot = Column(String(50), nullable=True)
    seat_price = Column(Numeric(12, 2), nullable=False)
    seat_status = Column(String(20), nullable=False, default="HELD", server_default="HELD")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        UniqueConstraint("booking_id", "seat_id", name="uq_booking_seats_booking_seat"),
        CheckConstraint("seat_price >= 0", name="ck_booking_seats_price_non_negative"),
        CheckConstraint(
            "seat_status IN ('HELD','CONFIRMED','CANCELLED','RELEASED')",
            name="ck_booking_seats_status",
        ),
        Index("ix_booking_seats_show_seat_status", "show_id", "seat_id", "seat_status"),
        Index(
            "uq_booking_seats_active_show_seat",
            "show_id",
            "seat_id",
            unique=True,
            postgresql_where=text("seat_status IN ('HELD','CONFIRMED')"),
            sqlite_where=text("seat_status IN ('HELD','CONFIRMED')"),
        ),
    )


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(BigInteger, Identity(always=True), primary_key=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    provider = Column(String(50), nullable=False, default="mock", server_default="mock")
    provider_order_id = Column(String(100), nullable=True)
    provider_payment_id = Column(String(100), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="INR", server_default="INR")
    payment_status = Column(String(30), nullable=False, default="INITIATED", server_default="INITIATED", index=True)
    idempotency_key = Column(String(100), nullable=True)
    failure_reason = Column(Text, nullable=True)
    metadata_json = Column(JSONB().with_variant(Text, "sqlite"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_payments_amount_non_negative"),
        CheckConstraint(
            "payment_status IN ('INITIATED','PENDING','AUTHORIZED','CAPTURED','FAILED','CANCELLED','REFUNDED')",
            name="ck_payments_status",
        ),
        Index(
            "uq_payments_provider_order_id",
            "provider_order_id",
            unique=True,
            postgresql_where=text("provider_order_id IS NOT NULL"),
            sqlite_where=text("provider_order_id IS NOT NULL"),
        ),
        Index(
            "uq_payments_provider_payment_id",
            "provider_payment_id",
            unique=True,
            postgresql_where=text("provider_payment_id IS NOT NULL"),
            sqlite_where=text("provider_payment_id IS NOT NULL"),
        ),
        Index(
            "uq_payments_idempotency_key",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
            sqlite_where=text("idempotency_key IS NOT NULL"),
        ),
    )


class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id = Column(BigInteger, Identity(always=True), primary_key=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    show_id = Column(BigInteger, ForeignKey("shows.show_id", ondelete="RESTRICT"), nullable=False, index=True)
    ticket_reference = Column(String(50), nullable=False, unique=True)
    qr_code_identifier = Column(String(120), nullable=False, unique=True)
    issued_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    ticket_status = Column(String(20), nullable=False, default="ISSUED", server_default="ISSUED", index=True)

    __table_args__ = (
        CheckConstraint(
            "ticket_status IN ('ISSUED','USED','CANCELLED','EXPIRED')",
            name="ck_tickets_status",
        ),
    )
