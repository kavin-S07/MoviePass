# gmoviepass

Reimplementation workspace for the MoviePass project, organized to mirror the reference split:
- `backend/` — FastAPI backend (auth/session/OAuth, theatres, screens/seats, dashboard APIs)
- `frontend/` — Booker-facing React + Vite SPA (port `5173`)
- `frontend-owner/` — Owner-facing React + Vite SPA (port `5174`, strict)

This repository contains the implemented/parity modules and placeholder/routed UI states present in the reference. It does **not** include runtime artifacts (`venv/`, `node_modules/`, `dist/`, caches) or real secrets.

## Prerequisites
- Python 3.10+ (recommended for current FastAPI/SQLAlchemy stack)
- Node.js + npm (for Vite/React frontends)
- PostgreSQL (backend/database-backed flows and tests)

## Environment configuration
- Use `.env.example` at repo root as a template. Copy values into local env files as needed (e.g. `backend/.env`) and fill locally. **Do not commit real `.env` files or secrets.**
- Key backend variables used by the implementation:
  - `DATABASE_URL` (SQLAlchemy URL, e.g. PostgreSQL/psycopg)
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `JWT_EXPIRES_IN` (default `15m`), `JWT_REFRESH_EXPIRES_IN` (default `7d`)
  - `SESSION_SECRET` (falls back to `JWT_SECRET` if unset)
  - `FRONTEND_URL` (default `http://localhost:5173`), `OWNER_FRONTEND_URL` (default `http://localhost:5174`)
  - `ENVIRONMENT` (`development`/`production`, affects refresh cookie security behavior)
  - Google OAuth (optional, for social login): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and callback/redirect URIs as configured in your Google client; backend uses app callback route `GET /auth/{provider}/callback`, named `social_callback`)
- Frontend API base URL is currently hardcoded to `http://localhost:8000` in both SPAs.

## Backend (FastAPI)
From `gmoviepass/backend`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the API (ensure required env vars are set, especially DB/JWT secrets):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `GET /` → `{ "message": "MoviePass API is running" }`
- Main implemented areas: auth/signup/login/home, refresh-cookie session lifecycle (issue/refresh/rotate/revoke/logout/sessions), admin owner approval flows, Google OAuth start/callback redirects, theatres/dashboard CRUD+stats, screens/seats creation & layout persistence APIs.
- SQL migration artifacts in `backend/` (`social_auth_migration.sql`, `refresh_sessions_migration.sql`, `theatres_migration.sql`, `screens_migration.sql`) are provided for schema parity/reference; apply/manage them according to your local DB workflow (not auto-applied by app startup).

## Frontend apps (Vite + React)

### Booker app (`frontend/`, port 5173)
```bash
cd gmoviepass/frontend
npm install
npm run dev
```
- Auth/session UI: email/password login & signup, Google social redirect initiation, session restore/refresh handling, logout, role-based notice/home shell.
- No movie browsing/booking/ticket features (not present in reference).

### Owner app (`frontend-owner/`, port 5174)
```bash
cd gmoviepass/frontend-owner
npm install
npm run dev
```
- Auth/gating shell for theatre owners (pending/rejected/non-owner notices), owner login/signup, social redirect, profile, layout/sidebar navigation.
- Implemented: dashboard/theatre management (list/create/edit/details/delete) and add-screen wizard (info → seat designer → preview/save) integrated with backend APIs.
- Placeholder/routed or unrouted parity pages remain non-functional where reference is placeholder-only (e.g. Movies/Shows management not implemented as domain CRUD; some legacy/unrouted placeholder components kept for parity).

## Backend auth tests
Tests live in `backend/tests` (`test_refresh_sessions.py`, `test_social_auth.py`) and use a separate PostgreSQL test database.

- Set `TEST_DATABASE_URL` to a **local, disposable** test database (do not use production data). If unset, tests default to a local connection string in code—override via env for your environment.
- Ensure required JWT/session env vars are available (tests set defaults for many values; provide compatible DB/driver and Google OAuth test env as needed).
- Install dependencies and run from `backend/`:

```bash
cd gmoviepass/backend
source .venv/bin/activate  # if using venv
pip install -r requirements.txt
pytest -q tests/test_refresh_sessions.py tests/test_social_auth.py
```

**Note:** test setup drops/creates tables in the configured test database; use an isolated test DB only.

## Known limitations / parity notes
- Implements reference-parity behavior for included auth, theatre, and screen flows only. Movies/shows management, booking, payments, and other non-existent reference domain features are intentionally not implemented.
- Some owner UI pages are placeholders or unrouted parity artifacts matching reference state.
- Frontend API base URL and dev ports are fixed to local defaults in code; adjust carefully if your environment differs.
- No production hardening, deployment config, or secret management included—local development/setup intent only. Never commit `.env` files or credentials.
