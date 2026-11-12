-- Phase 1 & 2 migration: theatres, screens, movies, shows, seat catalogue
-- BIGINT identity primary keys match the project's existing tables.

-- 1. Movies (central catalogue; needed for Phase 1 stats)
CREATE TABLE IF NOT EXISTS movies (
    movie_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movie_name     VARCHAR(200) NOT NULL,
    poster_url     VARCHAR(500),
    release_date   DATE,
    director_name  VARCHAR(150),
    description    TEXT,
    duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    language       VARCHAR(50),
    genre          VARCHAR(80),
    certification  VARCHAR(10),
    cast_names     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_movies_name ON movies (movie_name);

-- 2. Theatres (owner-scoped)
CREATE TABLE IF NOT EXISTS theatres (
    theatre_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           VARCHAR(150) NOT NULL,
    address        TEXT NOT NULL,
    city           VARCHAR(100),
    state          VARCHAR(100),
    pincode        VARCHAR(10),
    latitude       DECIMAL(9,6),
    longitude      DECIMAL(9,6),
    contact_number VARCHAR(15),
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_theatres_owner ON theatres (owner_id);
CREATE INDEX IF NOT EXISTS ix_theatres_city ON theatres (city);
CREATE INDEX IF NOT EXISTS ix_theatres_status ON theatres (status);

-- 3. Screens
CREATE TABLE IF NOT EXISTS screens (
    screen_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    theatre_id     BIGINT NOT NULL REFERENCES theatres(theatre_id) ON DELETE CASCADE,
    screen_name    VARCHAR(100) NOT NULL,
    no_of_rows     INT NOT NULL CHECK (no_of_rows > 0 AND no_of_rows <= 52),
    no_of_columns  INT NOT NULL CHECK (no_of_columns > 0 AND no_of_columns <= 40),
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (theatre_id, screen_name)
);
CREATE INDEX IF NOT EXISTS ix_screens_theatre ON screens (theatre_id);

-- 4. Seat categories
CREATE TABLE IF NOT EXISTS seat_categories (
    category_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    screen_id      BIGINT NOT NULL REFERENCES screens(screen_id) ON DELETE CASCADE,
    category_name  VARCHAR(50) NOT NULL,
    price          DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (screen_id, category_name)
);
CREATE INDEX IF NOT EXISTS ix_seat_categories_screen ON seat_categories (screen_id);

-- 5. Seats
CREATE TABLE IF NOT EXISTS seats (
    seat_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    screen_id      BIGINT NOT NULL REFERENCES screens(screen_id) ON DELETE CASCADE,
    category_id    BIGINT REFERENCES seat_categories(category_id) ON DELETE SET NULL,
    seat_name      VARCHAR(10) NOT NULL,
    row_number     INT NOT NULL,
    column_number  INT NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (screen_id, seat_name),
    UNIQUE (screen_id, row_number, column_number)
);
CREATE INDEX IF NOT EXISTS ix_seats_screen ON seats (screen_id);
CREATE INDEX IF NOT EXISTS ix_seats_category ON seats (category_id);

-- 6. Shows
CREATE TABLE IF NOT EXISTS shows (
    show_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    screen_id      BIGINT NOT NULL REFERENCES screens(screen_id) ON DELETE CASCADE,
    movie_id       BIGINT NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    show_date      DATE NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS ix_shows_screen_date ON shows (screen_id, show_date);
CREATE INDEX IF NOT EXISTS ix_shows_movie ON shows (movie_id);
CREATE INDEX IF NOT EXISTS ix_shows_date ON shows (show_date);
