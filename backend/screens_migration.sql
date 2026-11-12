-- Screens & Seat Layout migration
ALTER TABLE screens
    ADD COLUMN IF NOT EXISTS screen_number INT;

ALTER TABLE screens
    ADD COLUMN IF NOT EXISTS has_categories BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE screens
    ADD COLUMN IF NOT EXISTS default_price DECIMAL(10,2);

ALTER TABLE screens
    ADD COLUMN IF NOT EXISTS layout_config JSONB;

-- Category color
ALTER TABLE seat_categories
    ADD COLUMN IF NOT EXISTS color VARCHAR(30) NOT NULL DEFAULT '#3b82f6';

-- Index for seat lookups per screen
CREATE INDEX IF NOT EXISTS ix_seats_screen_cat ON seats (screen_id, category_id);
