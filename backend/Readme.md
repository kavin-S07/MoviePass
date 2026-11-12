# MoviePass Backend (`gmoviepass/backend`)

FastAPI backend implementing reference-parity modules for authentication/session management (including refresh-cookie rotation and Google OAuth), admin owner-approval flows, theatres/dashboard, and screens/seats/layout APIs.

## Requirements
- Python 3.10+
- PostgreSQL (for normal operation and integration-style auth tests)
- Dependencies listed in `requirements.txt`

## Setup
```bash
cd gmoviepass/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Configure environment variables locally (do **not** commit secrets). Common variables:
- `DATABASE_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN` (default `15m`), `JWT_REFRESH_EXPIRES_IN` (default `7d`)
- `SESSION_SECRET` (defaults to `JWT_SECRET` when unset)
- `FRONTEND_URL` (default `http://localhost:5173`), `OWNER_FRONTEND_URL` (default `http://localhost:5174`)
- `ENVIRONMENT` (`development` or `production`)
- Google OAuth (optional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Run
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Health check: `GET /` → `{"message":"MoviePass API is running"}`
- Interactive docs (FastAPI defaults): `/docs`, `/openapi.json`

## Implemented API areas
- **Auth core:** `POST /auth/signup`, `POST /auth/signup/owner`, `POST /auth/login`, `GET /auth/home`
- **Session lifecycle:** `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/sessions`, `DELETE /auth/sessions/{session_id}` (HttpOnly refresh cookie, rotation/revocation, CSRF/origin checks for cookie flows)
- **Admin owner approvals:** `GET /auth/admin/pending-owners`, `POST /auth/admin/approve/{owner_id}`, `POST /auth/admin/reject/{owner_id}` (admin seed on startup)
- **Google OAuth:** `GET /auth/{provider}` and callback `GET /auth/{provider}/callback` (`social_callback`) with frontend hash redirects and session cookie integration
- **Theatres & dashboard:** `GET /dashboard/stats`, `GET/POST /theatres`, `GET/PUT/DELETE /theatres/{theatre_id}`
- **Screens & seats:** `POST /theatres/{theatre_id}/screens`, `GET /theatres/{theatre_id}/screens`, `GET /screens/{screen_id}`, `DELETE /screens/{screen_id}`

## Database / migrations
Migration SQL artifacts for parity/reference are included in this directory:
- `social_auth_migration.sql`
- `refresh_sessions_migration.sql`
- `theatres_migration.sql`
- `screens_migration.sql`

Apply/manage schema changes according to your local PostgreSQL workflow (migrations are not auto-applied by the app).

## Tests
Auth regression tests: `tests/test_refresh_sessions.py`, `tests/test_social_auth.py`.

- Use a **separate local test database** via `TEST_DATABASE_URL` (tests may drop/create tables). Never point tests at production data.
- Run from `backend/` with dependencies installed and required env configured:

```bash
pytest -q tests/test_refresh_sessions.py tests/test_social_auth.py
```

## Notes / limitations
- Implements reference-parity backend behavior for included modules only; movies/shows CRUD, booking, payments, and other non-existent domain features are not implemented.
- No production deployment/secrets management configuration is included.
