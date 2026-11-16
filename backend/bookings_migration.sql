-- Bookings foundation migration (ordered). Additive only; does not drop or alter existing tables.
-- Execute after: theatres_migration.sql and screens_migration.sql (and after users table exists).
-- PostgreSQL.

BEGIN;

-- 1) bookings
CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_reference VARCHAR(40) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    show_id BIGINT NOT NULL REFERENCES shows(show_id) ON DELETE RESTRICT,
    booking_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    convenience_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    lock_expires_at TIMESTAMPTZ NULL,
    confirmed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bookings_booking_reference UNIQUE (booking_reference),
    CONSTRAINT ck_bookings_status CHECK (booking_status IN ('PENDING','PAYMENT_PENDING','CONFIRMED','CANCELLED','FAILED','EXPIRED')),
    CONSTRAINT ck_bookings_amounts_non_negative CHECK (subtotal >= 0 AND tax_amount >= 0 AND convenience_fee >= 0 AND total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS ix_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS ix_bookings_show_id ON bookings(show_id);
CREATE INDEX IF NOT EXISTS ix_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS ix_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS ix_bookings_user_created ON bookings(user_id, created_at DESC);

-- 2) seat_locks (temporary holds per show-seat)
CREATE TABLE IF NOT EXISTS seat_locks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    show_id BIGINT NOT NULL REFERENCES shows(show_id) ON DELETE CASCADE,
    seat_id BIGINT NOT NULL REFERENCES seats(seat_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id BIGINT NULL REFERENCES bookings(booking_id) ON DELETE SET NULL,
    lock_token VARCHAR(64) NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ NULL,
    lock_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT ck_seat_locks_status CHECK (lock_status IN ('ACTIVE','RELEASED','EXPIRED','CONVERTED')),
    CONSTRAINT ck_seat_locks_expiry CHECK (expires_at > locked_at)
);

CREATE INDEX IF NOT EXISTS ix_seat_locks_show_id ON seat_locks(show_id);
CREATE INDEX IF NOT EXISTS ix_seat_locks_seat_id ON seat_locks(seat_id);
CREATE INDEX IF NOT EXISTS ix_seat_locks_user_id ON seat_locks(user_id);
CREATE INDEX IF NOT EXISTS ix_seat_locks_booking_id ON seat_locks(booking_id);
CREATE INDEX IF NOT EXISTS ix_seat_locks_lock_token ON seat_locks(lock_token);
CREATE INDEX IF NOT EXISTS ix_seat_locks_status_expires ON seat_locks(lock_status, expires_at);
CREATE INDEX IF NOT EXISTS ix_seat_locks_show_status ON seat_locks(show_id, lock_status);

-- Prevent multiple active locks for the same show-seat combination at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_locks_active_show_seat
    ON seat_locks(show_id, seat_id)
    WHERE lock_status = 'ACTIVE';

-- 3) booking_seats (seat line items; server-calculated prices)
CREATE TABLE IF NOT EXISTS booking_seats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    show_id BIGINT NOT NULL REFERENCES shows(show_id) ON DELETE RESTRICT,
    seat_id BIGINT NOT NULL REFERENCES seats(seat_id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seat_name_snapshot VARCHAR(20) NOT NULL,
    category_name_snapshot VARCHAR(50) NULL,
    seat_price NUMERIC(12,2) NOT NULL,
    seat_status VARCHAR(20) NOT NULL DEFAULT 'HELD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_booking_seats_booking_seat UNIQUE (booking_id, seat_id),
    CONSTRAINT ck_booking_seats_price_non_negative CHECK (seat_price >= 0),
    CONSTRAINT ck_booking_seats_status CHECK (seat_status IN ('HELD','CONFIRMED','CANCELLED','RELEASED'))
);

CREATE INDEX IF NOT EXISTS ix_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS ix_booking_seats_show_id ON booking_seats(show_id);
CREATE INDEX IF NOT EXISTS ix_booking_seats_seat_id ON booking_seats(seat_id);
CREATE INDEX IF NOT EXISTS ix_booking_seats_user_id ON booking_seats(user_id);
CREATE INDEX IF NOT EXISTS ix_booking_seats_show_seat_status ON booking_seats(show_id, seat_id, seat_status);

-- Prevent duplicate held/confirmed bookings for the same show-seat combination.
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_seats_active_show_seat
    ON booking_seats(show_id, seat_id)
    WHERE seat_status IN ('HELD','CONFIRMED');

-- 4) payments (no raw card/payment credential storage)
CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL DEFAULT 'mock',
    provider_order_id VARCHAR(100) NULL,
    provider_payment_id VARCHAR(100) NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    idempotency_key VARCHAR(100) NULL,
    failure_reason TEXT NULL,
    metadata_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_payments_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT ck_payments_status CHECK (payment_status IN ('INITIATED','PENDING','AUTHORIZED','CAPTURED','FAILED','CANCELLED','REFUNDED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_order_id ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment_id ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS ix_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS ix_payments_status ON payments(payment_status);

-- 5) tickets
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    show_id BIGINT NOT NULL REFERENCES shows(show_id) ON DELETE RESTRICT,
    ticket_reference VARCHAR(50) NOT NULL,
    qr_code_identifier VARCHAR(120) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ticket_status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    CONSTRAINT uq_tickets_ticket_reference UNIQUE (ticket_reference),
    CONSTRAINT uq_tickets_qr_code_identifier UNIQUE (qr_code_identifier),
    CONSTRAINT ck_tickets_status CHECK (ticket_status IN ('ISSUED','USED','CANCELLED','EXPIRED'))
);

CREATE INDEX IF NOT EXISTS ix_tickets_booking_id ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS ix_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS ix_tickets_show_id ON tickets(show_id);
CREATE INDEX IF NOT EXISTS ix_tickets_status ON tickets(ticket_status);

COMMIT;
