# MoviePass — System Design (Code-Verified)

**Scope:** `gmoviepass` — FastAPI backend + two React/Vite frontends (`frontend` = towel-booking/"booker", `frontend-owner` = owner/admin portal). This document describes the architecture as it exists in the code, including the cookie-based access-token design now in place.

---

## 1. Architecture at a Glance

Three deployables, one shared PostgreSQL database and backend API:

```
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL (DATABASE_URL)                                │
│  users · social_accounts · refresh_sessions · theatres     │
│  screens · seat_categories · seats · shows · movies        │
│  bookings · seat_locks · booking_seats · payments          │
│  tickets · notifications                                   │
└──────────────────────────────────────────────────────────┘
        ▲                                          │
        │ SQLAlchemy                               │ JWT (HS256)
        │                                          │ access token: 15m (HttpOnly cookie)
        ▼                                          ▼
┌─────────────────────────────────────┐   ┌──────────────────────┐
│  FastAPI backend :8001              │   │  frontend :5173      │
│  (REST, Pydantic v2, slowapi,       │   │  React 19 + Vite +   │
│   Authlib, jose, pwdlib)            │   │  React Router (booker)│
└─────────────────────────────────────┘   └──────────────────────┘
                                            │
                                            ▼
                               ┌──────────────────────┐
                               │  frontend-owner :5174│
                               │  React 19 + Vite     │
                               │  custom nav, layouts │
                               └──────────────────────┘
```

Deployment is split by port: backend `:8001`, booker SPA `:5173`, owner/admin SPA `:5174`. Both SPAs call the same backend origin (`http://localhost:8001`, hardcoded per `frontend/src/services/api.js` / `frontend-owner/src/services/api.js`).

---

## 2. Backend Design

### 2.1 Layers (per module)

Every backend module (`Modules/*/`) follows the same three-tier split, plus schemas at module level:

- **Controller** (`Controller.py`) — FastAPI routers: `@router` + `@Depends(get_db)` + Pydantic request/response validation; calls Service.
- **Service** (`Service.py`) — business logic, authorization checks, orchestration, commits/rollbacks; calls Repository.
- **Repository** (`Repository.py`) — DB queries (`db.query(Model).filter(...)`), row-lock patterns (`for_update=True`).
- **Model** (`Model.py`) — SQLAlchemy declarative entities; **Schema** (`Schema.py`) — Pydantic DTOs for requests/responses.

Shared plumbing:

- `config/database.py` — `engine` from `DATABASE_URL`, `SessionLocal`, `get_db()` generator dependency.
- `config/Jwt.py` — password hashing (`pwdlib`), JWT access/refresh creation & decode (HS256), expiry parsing, refresh-token hashing/`compare_digest` helpers.
- `config/rate_limit.py` — slowapi `Limiter` (IP keyed, `200000/15m` default, `AUTH_RATE_LIMIT = 20/15m` on auth endpoints).
- `Middleware/jwtVerify.py` — global HTTP middleware.
- `main.py` — app assembly, admin seed, CORS, routers.

### 2.2 Modules and responsibilities

| Module | Key responsibility | Main endpoints (Controller) |
|---|---|---|
| `Auth` | Signup/login, cookie session lifecycle, sessions/revoke, profile, owner approval | `/auth/signup(/owner)`, `/login`, `/refresh`, `/logout`, `/logout-all`, `/sessions[/{id}]`, `/profile(PATCH)`, `/home`, `/admin/pending-owners`, `/admin/approve/{id}`, `/admin/reject/{id}`, `/auth/{provider}[/callback]` |
| `Theatres` | Owner dashboard stats, theatre CRUD | `/dashboard/stats`, `/theatres` CRUD |
| `Screens` | Screen + seat category + seats creation & listing, layout JSON | `/theatres/{id}/screens`, `/screens/{id}` |
| `Movies` | Movie CRUD (owner/admin; delete blocked if shows reference) | `/movies` CRUD |
| `Shows` | Show list/create with overlap validation | `/shows` |
| `Booker` | Discovery for bookers: home, movies/filters, details, show discovery | `/booker/*` |
| `Bookings` | Seats/locks/booking summary/checkout/payments/tickets/cancellations | `/bookings/*`, `/payments/*` |
| `Notifications` | In-app booker notifications | `/notifications/*` |
| `Admin` | Admin overview + paginated read APIs | `/admin/*` |

### 2.3 Cross-cutting concerns

- **Global middleware (`jwtVerify.py`)** — validates the access JWT on all non-exempt routes (`/auth/login|signup|signup/owner|refresh|logout`, webhook, docs/health/root, `/auth/google*`). Exempts OPTIONS; otherwise returns 401 JSON.
- **`Auth.Dependencies.get_token`** — extracts the access token for endpoint dependencies (OpenAPI bearer scheme + manual header + cookie fallback + `?token=`).
- **Cookie-CSRF checks** — `enforce_csrf_for_cookie_auth()` (origin/referer allowlist) guards cookie-authenticated refresh/logout.
- **Rate limiting** — slowapi with IP key + route-specific auth limits (20/15m) + generic 200k/15m default.
- **Admin seed** — `seed_admin()` in lifespan, driven by `SEED_DEFAULT_ADMIN`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- **Migrations** — static SQL files (`theatres_migration.sql`, `screens_migration.sql`, `refresh_sessions_migration.sql`, `bookings_migration.sql`, `notifications_migration.sql`, `social_auth_migration.sql`, `payments_razorpay_migration.sql`); applied manually, not auto-run by `main.py`.

---

## 3. Data Design

Ten+ tables, most under `public` in PostgreSQL. Key entities and their salient columns:

- **`users`** — `id` (BIGINT identity PK), `name`, `email` (unique), `password` (nullable — social-only accounts), `role` (`TICKET_BOOKER|THEATRE_OWNER|ADMIN`), `phone_no`, `approval_status` (`APPROVED|PENDING|REJECTED`).
- **`social_accounts`** — `id`, `user_id` FK→users (CASCADE), unique `(provider, provider_user_id)`, `provider`, `provider_user_id`, `provider_email`, `created_at`.
- **`refresh_sessions`** — `id`, `user_id` FK→users (CASCADE), `refresh_token_hash` (UNIQUE, stores session JTI — raw tokens are hashed via SHA-256 and compared with `hmac.compare_digest`), `ip_address`, `user_agent`, `device_name`, `created_at`, `expires_at`, `last_used_at`, `revoked_at`, `is_active` (indexes on user/active/expiry).
- **`theatres` / `screens` / `seat_categories` / `seats` / `shows` / `movies`** — theatre owned by `owner_id` (FK users); screens reference theatres; categories+seats reference screens; shows reference movies+screens; all with timestamps and name uniques.
- **`bookings`** — `booking_id`, `booking_reference` (unique), `user_id` FK, `show_id` FK, `booking_status` (CHECK: `PENDING|PAYMENT_PENDING|CONFIRMED|CANCELLED|FAILED|EXPIRED`), money fields (`subtotal`, `tax_amount`, `convenience_fee`, `total_amount` NUMERIC(12,2) CHECK ≥ 0), `currency`, `lock_expires_at`, `confirmed_at`, `cancelled_at`.
- **`seat_locks`** — `show_id`, `seat_id`, `user_id` FKs; `booking_id` FK→bookings SET NULL; `lock_token` (64 chars, indexed); `locked_at`, `expires_at`; `lock_status` (CHECK `ACTIVE|RELEASED|EXPIRED|CONVERTED`); partial unique index `(show_id, seat_id)` WHERE `lock_status='ACTIVE'`.
- **`booking_seats`** — `booking_id`, `show_id`, `seat_id` (RESTRICT FKs), `seat_name_snapshot`, `category_name_snapshot`, `seat_price`, `seat_status` (CHECK `HELD|CONFIRMED|CANCELLED|RELEASED`); partial unique index on `(show_id, seat_id)` where status IN (`HELD`,`CONFIRMED`).
- **`payments`** — `provider` (default `mock`, plus `payment_provider` for real ones), `provider_order_id`, `provider_payment_id` (plus explicit `razorpay_order_id`/`razorpay_payment_id`), `amount`, `payment_status` (CHECK `INITIATED|PENDING|AUTHORIZED|CAPTURED|FAILED|CANCELLED|REFUNDED|CREATED`), `idempotency_key` + partial uniques (null-safe).
- **`tickets`** — `booking_id`, `user_id`, `show_id`, unique `ticket_reference` + `qr_code_identifier`, `issued_at`, `ticket_status` (CHECK `ISSUED|USED|CANCELLED|EXPIRED`).
- **`notifications`** — `user_id` FK CASCADE, `type`, `title`, `message`, `related_booking_id` FK SET NULL, `is_read`, `created_at`, `read_at`.

Concurrency is handled via DB-level guards (partial unique indexes, CHECKs) plus service-level `SELECT ... FOR UPDATE` patterns and stale-lock expiry logic.

---

## 4. Backend Architecture Detail

### 4.1 Auth & session design (current implementation)

**Tokens:**

| Token | Where stored | Lifetime | How used |
|---|---|---|---|
| Access JWT (HS256) | **HttpOnly cookie `access_token`** (set by FastAPI on login/signup/refresh; cleared on logout) | `JWT_EXPIRES_IN` default `15m` | Browser attaches automatically; backend reads cookie via `get_token` + middleware fallback. JS escape hatch exists only for the social redirect (`Authorization: Bearer` via hash token). |
| Refresh JWT + session record | HttpOnly cookie `refresh_token` (path `/auth`) + row in `refresh_sessions` | `JWT_REFRESH_EXPIRES_IN` default `7d` | Refresh flow is CSRF-guarded (origin/referer allowlist) and rotates: old session revoked, new session issued atomically. |

**Flow highlights:**

- `login_user` / `_signup` → issue access + refresh tokens → set both cookies → return `{message, user, access_token, token_type}` (legacy body preserved for compatibility).
- `refresh_user_session` → reads refresh cookie → validates session (`is_active`, `revoked_at`, expiry, JTI match via hash) → **rotates** (revokes old, inserts new session) → sets new `refresh_token` and `access_token` cookies.
- `logout_user_session` / `logout_all_user_sessions` → revoke session(s), clear both cookies.
- Middleware + `get_token` accept: `Authorization: Bearer` → access cookie → `?token=` (compat for external clients).
- **Revoke-on-expiry:** reusing a rotated refresh token is detected (hash mismatch) and rejected; expired sessions rejected; all 401s clear the refresh cookie where applicable.

**Security posture:** cookies are `HttpOnly` + `SameSite=Lax` (+`Secure` when `ENVIRONMENT=production`). Password hashing via pwdlib; JWT secrets from env. CORS (`main.py`) uses `allow_credentials=True` with the two frontend origins.

### 4.2 Booking pipeline (state machine via `bookings.booking_status`)

`PENDING → PAYMENT_PENDING → CONFIRMED → CANCELLED | FAILED | EXPIRED`

Key mechanics (`Bookings/Service.py`, ~1,600 lines): seat layout + availability; `lock_seats` (TTL-based; `lock_expires_at`); `release_seat_locks`; `checkout_create_booking` (recalculates amounts server-side); `verify_payment` (sandbox signature verify → `_confirm_booking_from_verified_payment`; creates tickets via `_ensure_tickets_for_confirmed_booking`); `retry_payment`; `cancel_booking` (eligibility checks, seat release, ticket cancel, internal refund-status transitions); notifications via `_notify()`. `get_show_seat_availability`, `get_booking_summary`, sandbox helpers endpoint, ticket retrieval/download-data endpoints, and `verify_ticket` (staff/booker redeem rules) complete the flow.

### 4.3 Payments

`Bookings/Payments.py` defines `BasePaymentProvider` with `RazorpayPaymentProvider` (official `razorpay` SDK, Orders API) and a **sandbox provider as default** (`PAYMENT_PROVIDER` env). Live gateway integration is not implemented (see gaps).

---

## 5. Frontend Architecture Detail

### 5.1 Common `api.js` pattern (both apps)

- `apiFetch(path, options)` — single fetch wrapper. `credentials: 'include'` on all calls (so the HttpOnly access cookie is sent). On 401 and `retry=true` it calls `/auth/refresh` once, then retries.
- Error mapping via `getApiErrorMessage` (backend `detail` strings + status fallbacks + 429 `Retry-After`).

### 5.2 Booker SPA (`frontend/`)

- `App.jsx` — `BrowserRouter`; routes for auth (guests), booking flow, checkout, payments, bookings, profile, notifications; `RequireBooker`/`GuestOnly` guards (`router/RouteGuards.jsx`).
- `context/AuthContext.jsx` — session state (`user`, `ready`), login/signup/logout, social-redirect hash handling, session restore via `fetchHome()`.
- `context/BookingFlowContext.jsx` — discovery/booking state (city, search, movie, show, seat layout, lock info, payment flow) + `loadHome/loadFilters/refreshUnreadCount`.
- Services: `auth`, `booker`, `bookings`, `notifications`.
- Pages: Login/Signup/Home/Movies/MovieDetails/ShowSelection/SeatSelection/Checkout/PaymentResult/MyBookings/BookingDetails/Profile/Notifications.
- Components: Navbar, MovieSection, MovieCard, TicketView, SocialButtons, etc.

### 5.3 Owner SPA (`frontend-owner/`)

- `App.jsx` — custom navigation (no React Router): `parseNavFromPath`/`pathForNav` + `history.pushState/replaceState`; role-aware layouts (`components/Layout`, `Navbar`, `Sidebar`).
- Role rendering: ADMIN portal (overview/approvals/users/theatres/movies/shows), approved THEATRE_OWNER portal (dashboard/theatres/screens/movies/shows/profile), PENDING/REJECTED notices, and a "use the customer app" notice for non-owners.
- Services: `auth`, `theatres`, `screens`, `movies`, `shows`, `admin`.
- Pages: owner dashboard/theatres/theatre form/screens (incl. SeatDesigner/SeatPreview)/movies/show forms/admin pages.

---

## 6. Test & Tooling Surface

- Backend: `pytest` in `backend/tests/` (admin dashboard, bookings checkout/payment/seat locks, refresh sessions, social auth, profile/notifications, tickets/my bookings). Migrations in `backend/*.sql`.
- Frontend: `vite build` per app; `oxlint` lint (`npm run lint`).

---

## 7. Non-Functional Design Characteristics

- **Security:** HttpOnly/SameSite cookies; short-lived access JWT; DB-managed, rotating refresh sessions; CSRF origin allowlist for cookie endpoints; rate limiting on auth; admin seed behind env config; no secrets committed.
- **Performance:** Connection-pooled SQLAlchemy; row-lock + partial-unique concurrency guards prevent double-bookings; caching only N/A here (prototype scale).
- **Scalability:** Two independent SPAs behind one API; auth is the shared dependency — fast, stateless JWTs + DB-backed refresh sessions balance statelessness and revocability.
- **Observability/reliability:** Explicit commits/rollbacks, idempotency keys on payments, best-effort notifications (non-fatal on failure).

---

## 8. Known Gaps & Prototype Characteristics

- **Live payments** — sandbox only; "refunds" are internal payment/booking state transitions, not gateway settlements.
- **Show lifecycle** — no update/delete/cancel API; `Show.status` is write-only in practice.
- **Frontend API base URL** hardcoded to `http://localhost:8001` in both SPAs.
- **Frontend uses in-memory session state** for auth and booking flow (no storage); fine for dev prototypes.
- **`rzp_unified_session_id`** — not used anywhere; the project uses Razorpay Orders + the JS modal.

---

*This document is a code-verified analysis of the current state of the project, including the cookie-based access-token authentication that replaced the previous in-memory token mechanism.*
