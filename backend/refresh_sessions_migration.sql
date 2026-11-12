-- Database-managed refresh session architecture
-- Adds refresh_sessions table for HttpOnly cookie refresh token rotation.

CREATE TABLE IF NOT EXISTS refresh_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS ix_refresh_sessions_user_id
    ON refresh_sessions (user_id);

CREATE INDEX IF NOT EXISTS ix_refresh_sessions_is_active
    ON refresh_sessions (is_active);

CREATE INDEX IF NOT EXISTS ix_refresh_sessions_expires_at
    ON refresh_sessions (expires_at);
