# gmoviepass

Reimplementation workspace for the MoviePass project.

## Project layout

- `backend/` — FastAPI backend service (scaffold only in this stage)
- `frontend/` — Booker-facing frontend application (scaffold only in this stage)
- `frontend-owner/` — Owner-facing frontend application (scaffold only in this stage)

This repository currently contains baseline structure and hygiene files only. Application logic, dependencies, and runtime artifacts are not included.

## Setup intent

1. Copy `.env.example` to `.env` (and/or create per-app env files as needed) and provide local values. Never commit real secrets.
2. Implement backend and frontend applications in their respective directories in later stages, following the reference project topology.
3. Keep environment-specific configuration out of version control; rely on example/template files for shared defaults.
