-- MoviePass PostgreSQL schema
-- Based on the 18 tables and column/foreign-key details supplied.
-- Schema: public
--
-- IMPORTANT:
-- 1. This script creates the tables if they do not already exist.
-- 2. It does not insert application data.
-- 3. Identity/sequence definitions, indexes, UNIQUE constraints, CHECK
--    constraints and FK delete/update actions were not supplied, so they
--    are not guessed here.
-- 4. Run against an empty database for a clean schema creation.

BEGIN;

CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    role VARCHAR(30) NOT NULL,
    phone_no VARCHAR(10),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
);

CREATE TABLE IF NOT EXISTS public.movies (
    movie_id BIGINT PRIMARY KEY,
    movie_name VARCHAR(200) NOT NULL,
    poster_url VARCHAR(500),
    release_date DATE,
    director_name VARCHAR(150),
    description TEXT,
    duration_minutes INTEGER,
    language VARCHAR(50),
    genre VARCHAR(80),
    certification VARCHAR(10),
    cast_names TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theatres (
    theatre_id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES public.users(id),
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    latitude NUMERIC,
    longitude NUMERIC,
    contact_number VARCHAR(15),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.login_sessions (
    id BIGINT PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.social_accounts (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refresh_sessions (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    login_session_id BIGINT REFERENCES public.login_sessions(id),
    session_id VARCHAR(36),
    jti VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS public.screens (
    screen_id BIGINT PRIMARY KEY,
    theatre_id BIGINT NOT NULL REFERENCES public.theatres(theatre_id),
    screen_name VARCHAR(100) NOT NULL,
    no_of_rows INTEGER NOT NULL,
    no_of_columns INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    screen_number INTEGER,
    has_categories BOOLEAN NOT NULL DEFAULT false,
    default_price NUMERIC,
    layout_config JSONB
);

CREATE TABLE IF NOT EXISTS public.seat_categories (
    category_id BIGINT PRIMARY KEY,
    screen_id BIGINT NOT NULL REFERENCES public.screens(screen_id),
    category_name VARCHAR(50) NOT NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    color VARCHAR(30) NOT NULL DEFAULT '#3b82f6'
);

CREATE TABLE IF NOT EXISTS public.seats (
    seat_id BIGINT PRIMARY KEY,
    screen_id BIGINT NOT NULL REFERENCES public.screens(screen_id),
    category_id BIGINT REFERENCES public.seat_categories(category_id),
    seat_name VARCHAR(10) NOT NULL,
    row_number INTEGER NOT NULL,
    column_number INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theatre_movies (
    id BIGINT PRIMARY KEY,
    theatre_id BIGINT NOT NULL REFERENCES public.theatres(theatre_id),
    movie_id BIGINT NOT NULL REFERENCES public.movies(movie_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shows (
    show_id BIGINT PRIMARY KEY,
    screen_id BIGINT NOT NULL REFERENCES public.screens(screen_id),
    movie_id BIGINT NOT NULL REFERENCES public.movies(movie_id),
    show_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
    booking_id BIGINT PRIMARY KEY,
    booking_reference VARCHAR(40) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    show_id BIGINT NOT NULL REFERENCES public.shows(show_id),
    booking_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    convenience_fee NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    lock_expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_seats (
    id BIGINT PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES public.bookings(booking_id),
    show_id BIGINT NOT NULL REFERENCES public.shows(show_id),
    seat_id BIGINT NOT NULL REFERENCES public.seats(seat_id),
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    seat_name_snapshot VARCHAR(20) NOT NULL,
    category_name_snapshot VARCHAR(50),
    seat_price NUMERIC NOT NULL,
    seat_status VARCHAR(20) NOT NULL DEFAULT 'HELD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seat_locks (
    id BIGINT PRIMARY KEY,
    show_id BIGINT NOT NULL REFERENCES public.shows(show_id),
    seat_id BIGINT NOT NULL REFERENCES public.seats(seat_id),
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    booking_id BIGINT REFERENCES public.bookings(booking_id),
    lock_token VARCHAR(64) NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    lock_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS public.payments (
    payment_id BIGINT PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES public.bookings(booking_id),
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    provider VARCHAR(50) NOT NULL DEFAULT 'mock',
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100),
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    idempotency_key VARCHAR(100),
    failure_reason TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_provider VARCHAR(50),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id BIGINT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    event_id VARCHAR(150) NOT NULL,
    event_type VARCHAR(100),
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100),
    booking_id BIGINT REFERENCES public.bookings(booking_id),
    payload_json JSONB,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSED'
);

CREATE TABLE IF NOT EXISTS public.tickets (
    ticket_id BIGINT PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES public.bookings(booking_id),
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    show_id BIGINT NOT NULL REFERENCES public.shows(show_id),
    ticket_reference VARCHAR(50) NOT NULL,
    qr_code_identifier VARCHAR(120) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ticket_status VARCHAR(20) NOT NULL DEFAULT 'ISSUED'
);

CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    related_booking_id BIGINT REFERENCES public.bookings(booking_id),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

COMMIT;
