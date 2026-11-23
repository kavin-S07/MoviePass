# MoviePass Project Overview (Codebase Analysis)

**Project:** `gmoviepass` (FastAPI backend + React/Vite frontends)  
**Analysis basis:** Actual source code in repository (`backend/`, `frontend/`, `frontend-owner/`, migrations, tests, configs). No undocumented features were assumed.  
**Analysis date:** 2026-11-17

> Scope note: The repository contains two frontend applications (`frontend` = booker/customer SPA, `frontend-owner` = owner/admin SPA) and one backend API. All were analyzed.

---

## 1. System Overview

MoviePass is a movie ticketing platform prototype with three primary user roles:
- **TICKET_BOOKER**: discovers movies/shows, selects seats, performs sandbox checkout/payment verification, receives tickets/bookings/notifications, manages profile/sessions.
- **THEATRE_OWNER**: signs up (pending admin approval), manages owned theatres and screens/seat layouts, manages movies and show schedules (owner-scoped APIs), views owner dashboard data.
- **ADMIN**: seeded/configurable admin account, approves/rejects theatre owner registrations, views admin overview and paginated users/theatres/movies/shows lists (read APIs), and can access owner-protected resources in several backend services (admin bypass in ownership checks).

### High-level capabilities (implemented in code)
- Email/password auth, Google OAuth (Authlib) start/callback redirect flow, HttpOnly refresh-cookie session management with rotation/revocation.
- Theatre CRUD and owner dashboard stats.
- Screen + seat-category + seat-layout creation/storage (including JSON layout config), screen listing/details/delete.
- Movie catalog CRUD (owner/admin authenticated APIs).
- Show scheduling/listing for owner/admin with basic time-overlap validation.
- Booker discovery APIs: home sections, movie listing/filtering/search/sort/pagination, movie details, show discovery by date/theatre/city.
- Booking flow: show seat availability/layout, seat locking with TTL, lock release, booking summary, checkout/order creation, sandbox payment verify/retry/webhook handling, booking status/details, my bookings, cancellation/refund-state transition, ticket generation/retrieval/download-data, ticket verification/redemption endpoint.
- Notifications for booker (list, unread count, mark read/all) generated from booking/payment/cancellation flows.
- Profile and session management (booker UI/services; backend endpoints also exist).

### Known gaps / prototype characteristics (from code)
- No live payment gateway integration; sandbox provider only (`Modules/Bookings/Payments.py` fallback to sandbox).
- Frontend API base URL is hardcoded to `http://localhost:8001` in both SPAs (`frontend/src/services/api.js`, `frontend-owner/src/services/api.js`).
- Booking/payment frontend uses sandbox helper endpoint and manual signature/payment-id verification flow (`frontend/src/pages/CheckoutPage.jsx`).
- Some owner/admin UI pages are present but backend support may be limited to read/list/create patterns (e.g. no movie delete UI? owner has delete; no show edit/delete endpoints implemented in backend controller/service/repo). README notes parity placeholders exist.
- `frontend-owner` uses custom in-memory/history navigation in `App.jsx` (not React Router), while `frontend` uses `react-router-dom`.
- Seat selection page implementation is large/truncated in sampled view, but route wiring and service calls confirm integration with seat layout/lock APIs.

---

## 2. Repository & Runtime Structure

### Top-level
- `backend/` — FastAPI application, SQLAlchemy models/repos/services/controllers, migrations, tests
- `frontend/` — Booker/customer React + Vite SPA (port 5173)
- `frontend-owner/` — Owner/Admin React + Vite SPA (port 5174)
- `README.md`, `.gitignore`

### Backend structure (`backend/`)
- `main.py` — FastAPI app, lifespan admin seed, CORS, SessionMiddleware, JWT middleware registration, router includes, health endpoints
- `config/`
  - `database.py` — SQLAlchemy engine/session/Base (`DATABASE_URL` env)
  - `Jwt.py` — password hashing (`pwdlib`), access/refresh JWT create/decode, expiry parsing, refresh hash helpers, cookie security flag
- `Middleware/`
  - `jwtVerify.py` — global HTTP middleware enforcing bearer/query token validation with route exemptions (auth refresh/logout/login/signup, oauth, docs/health/root, payment webhook)
- `Modules/`
  - `Auth/` — auth/session/profile/owner approval/social login
  - `Theatres/` — theatre CRUD + dashboard stats
  - `Screens/` — screen/seat-category/seat creation & retrieval
  - `Movies/` — movie CRUD
  - `Shows/` — show listing/creation
  - `Booker/` — booker-facing movie discovery/show discovery APIs
  - `Bookings/` — booking, seat lock, checkout/payment, tickets, cancellation, verification
  - `Notifications/` — in-app notification APIs/storage
  - `Admin/` — admin overview and paginated list APIs
- SQL migrations: `social_auth_migration.sql`, `refresh_sessions_migration.sql`, `theatres_migration.sql`, `screens_migration.sql`, `bookings_migration.sql`, `notifications_migration.sql`
- `tests/` — pytest modules for admin dashboard, bookings checkout/payment/seat locks, refresh sessions, social auth, profile/notifications, tickets/my bookings
- `requirements.txt`

### Booker frontend structure (`frontend/src/`)
- `main.jsx` — React root + `BrowserRouter`
- `App.jsx` — route definitions, layouts, auth/booking providers, route components wiring to services
- `context/AuthContext.jsx` — token/user/session restore, login/signup/logout, OAuth redirect handling
- `context/BookingFlowContext.jsx` — discovery and booking flow in-memory state (city/search/movie/show/seat/lock/payment)
- `router/RouteGuards.jsx` — `RequireBooker`, `GuestOnly`
- `services/` — `api.js`, `auth.js`, `booker.js`, `bookings.js`, `notifications.js`
- `pages/` — login/signup/home/movies/movie details/show selection/seat selection/checkout/payment result/profile/bookings/booking details/notifications/not found/notice/placeholder
- `components/` — Navbar, MovieCard, MovieSection, TicketView, SocialButtons, icons
- `utils/qr.js` — QR rendering utility used by tickets

### Owner/Admin frontend structure (`frontend-owner/src/`)
- `main.jsx`, `App.jsx` — custom navigation state + URL path parsing/history handling (role-aware owner/admin routes)
- `context/AuthContext.jsx` — same auth/session restore pattern as booker (kind=`owner`)
- `components/` — Layout, Sidebar, Navbar, SocialButtons, icons/nav icons
- `services/` — `api.js`, `auth.js`, `theatres.js`, `screens.js`, `movies.js`, `shows.js`, `admin.js`
- `pages/` — owner dashboard/theatres/theatre form/details/screens/add screen flow/profile/movies/movie form/details/shows/show form; admin overview/approvals/users/theatres/movies/shows; auth/notice pages and additional UI helper pages (e.g. screen designer/preview/info/seat layout utils)

---

## 3. Backend Architecture

### 3.1 Architectural style
- **Framework:** FastAPI
- **Layering (module-level, mostly consistent):** `Controller` (router/endpoints) → `Service` (business/auth/validation/orchestration) → `Repository` (DB queries/persistence) → `Model`/`Schema`
- **ORM:** SQLAlchemy (`SessionLocal`, `declarative_base`)
- **Validation/serialization:** Pydantic schemas (request/response models)
- **Auth:** JWT access tokens (`Authorization: Bearer` or `?token=` fallback in dependency) + DB-managed refresh sessions in HttpOnly cookie
- **Middleware:** custom JWT verification middleware, CORS, Starlette session middleware (for OAuth state)
- **Transactions:** explicit commits/rollbacks in services (many booking operations use row locks / `SELECT ... FOR UPDATE` patterns)

### 3.2 Startup and cross-cutting components
- **`backend/main.py`**
  - Loads env (`dotenv`)
  - Seeds default admin user on startup if enabled (`SEED_DEFAULT_ADMIN`, defaults to admin credentials/env overrides)
  - Configures `SessionMiddleware` (`moviepass_session`) for OAuth
  - Registers JWT middleware `verify_jwt`
  - CORS allows configured frontend origins with credentials
  - Includes routers: auth, theatre, screen, movies, shows, admin, booker, bookings, notifications
  - Endpoints: `GET /`, `GET /health`
- **`Middleware/jwtVerify.py`**
  - Skips OPTIONS, login/signup, refresh/logout, webhook, docs/openapi/root/health, and `/auth/google*`
  - Validates access token from `Authorization` header or `token` query param using `decode_access_token`
  - Returns 401 JSON on invalid/expired token
- **`Modules/Auth/Dependencies.get_token`**
  - Extracts token from `HTTPBearer` credentials, raw Authorization header, or query param (compatibility for frontend usage)
- **`config/database.py`**
  - `get_db()` dependency yields/closes SQLAlchemy session

### 3.3 Module responsibilities

#### Auth (`Modules/Auth`)
- **Model:** `User`, `SocialAccount`, `RefreshSession`
- **Responsibilities:** signup (booker/owner), login, refresh rotation, logout/logout-all, session listing/revocation, profile get/update, home endpoint, admin owner approval endpoints (under `/auth/admin/...`), Google OAuth start/callback integration, role/approval checks.
- **Key services/helpers:** token issuance, CSRF checks for cookie-auth refresh/logout using origin/referer allowlist, device/IP capture, refresh risk assessment signal (non-blocking), cookie set/clear, owner/admin authorization helpers.

#### Theatres (`Modules/Theatres`)
- **Model (shared domain tables in this file):** `Movie`, `Theatre`, `Screen`, `SeatCategory`, `Seat`, `Show`
- **Responsibilities:** owner dashboard stats, owner theatre list/details/create/update/delete with ownership/admin checks.
- **Dashboard stats include:** counts (theatres/screens/movies/shows/upcoming shows), recent theatres, upcoming shows.

#### Screens (`Modules/Screens`)
- **Responsibilities:** create screen for a theatre with categories and seats in one transactional flow; list screens per theatre; get screen details (with category/seat enrichment); delete screen.
- **Authorization:** owner/admin via `Auth.Service.get_current_owner` and theatre ownership checks.
- **Notes:** creates default "Standard" category when `has_categories` is false; maps seat payloads to category IDs; stores layout config JSON.

#### Movies (`Modules/Movies`)
- **Responsibilities:** list/search/get/create/update/delete movies for authenticated owner/admin users.
- **Delete rule:** prevents deletion if movie is referenced by existing shows.

#### Shows (`Modules/Shows`)
- **Responsibilities:** list owner/admin shows (enriched with movie/theatre/screen names), create show with validation and ownership checks.
- **Validation:** movie and screen existence, owner access to screen's theatre, basic same-screen/date time-overlap prevention for non-cancelled shows.

#### Booker (`Modules/Booker`)
- **Responsibilities:** authenticated read/discovery APIs for ticket bookers (and any authenticated user via `get_authenticated_user` in service) to browse movies and discover showtimes.
- **Features:** home payload (featured/now showing/coming soon/trending/recommended + filters), movie listing with filters/sort/pagination, filters, movie detail with counts/status, movie show list, rich show discovery grouped by theatre/date with availability indicators and optional distance sorting.

#### Bookings (`Modules/Bookings`)
- **Models:** `Booking`, `SeatLock`, `BookingSeat`, `Payment`, `Ticket`
- **Responsibilities:** seat availability/layout for show, seat lock acquisition/release/expiry, booking summary, checkout and payment order creation, payment verification/retry/webhook (sandbox), booking status/details, my bookings, booking cancellation, ticket generation/retrieval/download-data, ticket verification/redemption.
- **Core mechanics (from service/repo):** DB-managed lock/booking seat states, server-side pricing/tax/fee calculation, idempotent-ish payment/confirmation handling, ticket issuance for confirmed bookings, notifications on payment/booking/cancel events.
- **Security/consistency patterns evident:** authenticated booker checks for booker flows, row locks/for-update queries in repository/service paths, stale lock expiration, conflict checks, provider abstraction with sandbox-only implementation.

#### Notifications (`Modules/Notifications`)
- **Model:** `Notification`
- **Responsibilities:** create/list notifications for ticket bookers, unread count, mark one/all read.
- **Integration:** booking service calls notification service helper (non-fatal on failure).

#### Admin (`Modules/Admin`)
- **Responsibilities:** admin-only overview and paginated read APIs for users/theatres/movies/shows.
- **Data sources:** aggregates counts/breakdowns and enriched list rows (joins to owners/theatres/screens/movies as needed).

### 3.4 API inventory (from controllers)

> Base URL: backend FastAPI app (default local `http://localhost:8001`). All protected endpoints require valid access token unless exempted by middleware; dependency-level token extraction is used in controllers.

#### Root/health
| Method | Path | Auth/Role | Purpose | Request | Response |
|---|---|---|---|---|---|
| GET | `/` | Public (middleware skip) | API running message | - | `{message}` |
| GET | `/health` | Public (middleware skip) | Health check | - | `{status:"ok"}` |

#### Auth (`/auth`)
| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/auth/signup` | Ticket booker signup | Creates TICKET_BOOKER (APPROVED), issues tokens, sets refresh cookie |
| POST | `/auth/signup/owner` | Theatre owner signup | Creates THEATRE_OWNER (PENDING), issues tokens, sets refresh cookie |
| POST | `/auth/login` | Login | Email/password; rejects social-only accounts without password; sets refresh cookie |
| POST | `/auth/refresh` | Refresh access token | Uses HttpOnly refresh cookie + CSRF origin/referer checks; rotates session |
| POST | `/auth/logout` | Logout current session | Uses refresh cookie; clears cookie |
| POST | `/auth/logout-all` | Logout all sessions | Requires access token; clears cookie |
| GET | `/auth/sessions` | List active sessions | Requires access token; marks current session by cookie jti |
| DELETE | `/auth/sessions/{session_id}` | Revoke session | Requires access token; clears cookie if current revoked |
| GET | `/auth/profile` | Get profile | Requires access token |
| PATCH | `/auth/profile` | Update profile | Name/phone only (forbidden fields rejected) |
| GET | `/auth/home` | Authenticated home payload | Returns welcome message + user |
| GET | `/auth/admin/pending-owners` | List pending owners | Admin-only (service check) |
| POST | `/auth/admin/approve/{owner_id}` | Approve owner | Admin-only |
| POST | `/auth/admin/reject/{owner_id}` | Reject owner | Admin-only |
| GET | `/auth/{provider}` | Start social OAuth | Supports providers in `Social.PROVIDERS` (Google implemented/configured) |
| GET | `/auth/{provider}/callback` | OAuth callback | Creates/links/login user, sets refresh cookie, redirects to frontend with access token fragment |

#### Dashboard & Theatres
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/dashboard/stats` | Owner/Admin dashboard stats | Owner scoped to own theatres; admin sees all |
| GET | `/theatres` | List theatres | Owner scoped/admin all; includes screen counts |
| GET | `/theatres/{theatre_id}` | Theatre details | Includes screens; owner ownership enforced |
| POST | `/theatres` | Create theatre | Authenticated owner/admin |
| PUT | `/theatres/{theatre_id}` | Update theatre | Partial-field-safe update behavior in service |
| DELETE | `/theatres/{theatre_id}` | Delete theatre | Ownership/admin enforced |

#### Screens & Seats
| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/theatres/{theatre_id}/screens` | Create screen + categories + seats | Transactional; layout config persisted |
| GET | `/theatres/{theatre_id}/screens` | List theatre screens | Returns brief info/categories/seat counts |
| GET | `/screens/{screen_id}` | Screen details | Returns categories and enriched seats |
| DELETE | `/screens/{screen_id}` | Delete screen | Ownership/admin enforced |

#### Movies
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/movies` | List movies | Optional `search` query; owner/admin auth required |
| GET | `/movies/{movie_id}` | Movie details | Owner/admin auth required |
| POST | `/movies` | Create movie | Owner/admin auth required |
| PUT | `/movies/{movie_id}` | Update movie | Owner/admin auth required |
| DELETE | `/movies/{movie_id}` | Delete movie | Blocked if referenced by shows |

#### Shows
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/shows` | List shows | Owner scoped/admin all; enriched response |
| POST | `/shows` | Create show | Validates movie/screen/ownership/time overlap |

#### Booker discovery (`/booker`)
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/booker/home` | Booker home sections | Optional `city`; authenticated user |
| GET | `/booker/movies` | Movie listing | Search/filter/sort/pagination/city/release status |
| GET | `/booker/movies/filters` | Filter options | Languages/genres/certifications/cities |
| GET | `/booker/movies/{movie_id}` | Movie detail | Includes release/booking/show counts |
| GET | `/booker/movies/{movie_id}/shows` | Show list for movie | Optional city/date/theatre filters |
| GET | `/booker/movies/{movie_id}/show-discovery` | Rich show discovery | Date selector data + theatres grouped with showtimes/bookability/sorting |

#### Bookings & tickets (`/bookings`)
| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/bookings/payments/webhook` | Payment webhook handler | Middleware-exempt; signature-verified in service |
| POST | `/bookings/tickets/verify` | Verify/redeem ticket | Auth required; staff redeem/verify rules in service |
| GET | `/bookings/shows/{show_id}/seats` | Seat layout + availability | Auth required; show/screen/theatre context |
| POST | `/bookings/shows/{show_id}/locks` | Lock seats | Creates/uses lock token & booking hold flow (service-defined) |
| POST | `/bookings/shows/{show_id}/locks/release` | Release locks | By lock token / seat ids (payload optional) |
| GET | `/bookings/summary` | Booking summary for lock token | Query: `lock_token` |
| POST | `/bookings/checkout` | Create/advance checkout | Body: `lock_token`; creates/reuses payment order (sandbox) |
| GET | `/bookings/my` | My bookings list | Grouped upcoming/past/cancelled (response schema/service) |
| GET | `/bookings/{booking_id}/details` | Booking details for owner (booker) | Requires ownership of booking in service |
| POST | `/bookings/{booking_id}/cancel` | Cancel booking | Eligibility/refund state handled in service |
| GET | `/bookings/{booking_id}/ticket` | Get/generate ticket | Confirmed bookings only |
| GET | `/bookings/{booking_id}/ticket/download` | Ticket download data | Same payload shape as ticket retrieval |
| POST | `/bookings/{booking_id}/payments/verify` | Verify payment | Sandbox signature verification flow |
| POST | `/bookings/{booking_id}/payments/retry` | Retry payment | Reuses/regenerates order when eligible |
| GET | `/bookings/{booking_id}/payments/sandbox/helpers` | Sandbox helper data | Sandbox-only |
| GET | `/bookings/{booking_id}` | Booking/payment status | Booking status summary |

#### Notifications (`/notifications`)
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/notifications` | List notifications | Ticket booker only |
| GET | `/notifications/unread-count` | Unread count | Ticket booker only |
| POST | `/notifications/{notification_id}/read` | Mark notification read | Ticket booker only |
| POST | `/notifications/read-all` | Mark all read | Ticket booker only |

#### Admin (`/admin`)
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/admin/overview` | Admin dashboard overview | Admin-only |
| GET | `/admin/users` | Paginated users list | Filters/search supported |
| GET | `/admin/theatres` | Paginated theatres list | Filters/search supported |
| GET | `/admin/movies` | Paginated movies list | Filters/search supported |
| GET | `/admin/shows` | Paginated shows list | Filters/search supported |

---

## 4. Database Design

### 4.1 Tables/entities (from models and migrations)

#### `users` (`Modules/Auth/Model.py`)
- `id` BIGINT identity PK
- `name` VARCHAR(100) NOT NULL
- `email` VARCHAR(255) UNIQUE NOT NULL
- `password` VARCHAR(255) NULL (social-only accounts allowed)
- `role` VARCHAR(30) NOT NULL (`TICKET_BOOKER`, `THEATRE_OWNER`, `ADMIN` used in code)
- `phone_no` VARCHAR(10) NULL
- `approval_status` VARCHAR(20) NOT NULL default `APPROVED` (`APPROVED|PENDING|REJECTED`)
- Relationships: `refresh_sessions`

#### `social_accounts`
- `id` BIGINT identity PK
- `user_id` FK -> `users.id` ON DELETE CASCADE, indexed
- `provider` VARCHAR(20) NOT NULL
- `provider_user_id` VARCHAR(255) NOT NULL
- `provider_email` VARCHAR(255) NULL
- `created_at` TIMESTAMPTZ NOT NULL
- Unique: (`provider`, `provider_user_id`)

#### `refresh_sessions`
- `id` BIGINT identity PK
- `user_id` FK -> `users.id` ON DELETE CASCADE
- `refresh_token_hash` VARCHAR(255) UNIQUE NOT NULL (stores jti/session identifier per code comments)
- `ip_address` VARCHAR(45) NULL
- `user_agent` TEXT NULL
- `device_name` VARCHAR(255) NULL
- `created_at` TIMESTAMPTZ NOT NULL
- `expires_at` TIMESTAMPTZ NOT NULL
- `last_used_at` TIMESTAMPTZ NULL
- `revoked_at` TIMESTAMPTZ NULL
- `is_active` BOOLEAN NOT NULL default true
- Indexes: user_id, is_active, expires_at (model/migration)

#### `movies` (`Modules/Theatres/Model.py`)
- `movie_id` BIGINT identity PK
- `movie_name` VARCHAR(200) NOT NULL
- `poster_url` VARCHAR(500) NULL
- `release_date` DATE NULL
- `director_name` VARCHAR(150) NULL
- `description` TEXT NULL
- `duration_minutes` INT NULL
- `language` VARCHAR(50) NULL
- `genre` VARCHAR(80) NULL
- `certification` VARCHAR(10) NULL
- `cast_names` TEXT NULL
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL

#### `theatres`
- `theatre_id` BIGINT identity PK
- `owner_id` FK -> `users.id` ON DELETE CASCADE, indexed
- `name` VARCHAR(150) NOT NULL
- `address` TEXT NOT NULL
- `city` VARCHAR(100) NULL
- `state` VARCHAR(100) NULL
- `pincode` VARCHAR(10) NULL
- `latitude` DECIMAL(9,6) NULL
- `longitude` DECIMAL(9,6) NULL
- `contact_number` VARCHAR(15) NULL
- `status` VARCHAR(20) NOT NULL default `ACTIVE`
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL

#### `screens`
- `screen_id` BIGINT identity PK
- `theatre_id` FK -> `theatres.theatre_id` ON DELETE CASCADE, indexed
- `screen_name` VARCHAR(100) NOT NULL
- `screen_number` INT NULL
- `no_of_rows` INT NOT NULL
- `no_of_columns` INT NOT NULL
- `has_categories` BOOLEAN NOT NULL default false
- `default_price` DECIMAL(10,2) NULL
- `layout_config` JSONB (SQLite variant TEXT in model)
- `status` VARCHAR(20) NOT NULL default `ACTIVE`
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL
- Unique: (`theatre_id`, `screen_name`)

#### `seat_categories`
- `category_id` BIGINT identity PK
- `screen_id` FK -> `screens.screen_id` ON DELETE CASCADE, indexed
- `category_name` VARCHAR(50) NOT NULL
- `price` DECIMAL(10,2) NOT NULL
- `color` VARCHAR(30) NOT NULL default `#3b82f6`
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL
- Unique: (`screen_id`, `category_name`)

#### `seats`
- `seat_id` BIGINT identity PK
- `screen_id` FK -> `screens.screen_id` ON DELETE CASCADE, indexed
- `category_id` FK -> `seat_categories.category_id` ON DELETE SET NULL, indexed
- `seat_name` VARCHAR(10) NOT NULL
- `row_number` INT NOT NULL
- `column_number` INT NOT NULL
- `is_active` BOOLEAN NOT NULL default true
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL
- Unique: (`screen_id`, `seat_name`), (`screen_id`, `row_number`, `column_number`)

#### `shows`
- `show_id` BIGINT identity PK
- `screen_id` FK -> `screens.screen_id` ON DELETE CASCADE, indexed
- `movie_id` FK -> `movies.movie_id` ON DELETE CASCADE, indexed
- `show_date` DATE NOT NULL
- `start_time` TIME NOT NULL
- `end_time` TIME NOT NULL
- `status` VARCHAR(20) NOT NULL default `Scheduled`
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL
- Check: `end_time > start_time`

#### `bookings` (`Modules/Bookings/Model.py`)
- `booking_id` BIGINT identity PK
- `booking_reference` VARCHAR(40) UNIQUE NOT NULL, indexed
- `user_id` FK -> `users.id` ON DELETE RESTRICT, indexed
- `show_id` FK -> `shows.show_id` ON DELETE RESTRICT, indexed
- `booking_status` VARCHAR(30) NOT NULL default `PENDING`
- `subtotal`, `tax_amount`, `convenience_fee`, `total_amount` NUMERIC(12,2) NOT NULL default 0
- `currency` VARCHAR(10) NOT NULL default `INR`
- `lock_expires_at`, `confirmed_at`, `cancelled_at` TIMESTAMPTZ NULL
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL
- Checks: status in (`PENDING`,`PAYMENT_PENDING`,`CONFIRMED`,`CANCELLED`,`FAILED`,`EXPIRED`), amounts >= 0
- Index: (`user_id`,`created_at`)

#### `seat_locks`
- `id` BIGINT identity PK
- `show_id` FK -> `shows.show_id` ON DELETE CASCADE
- `seat_id` FK -> `seats.seat_id` ON DELETE CASCADE
- `user_id` FK -> `users.id` ON DELETE CASCADE
- `booking_id` FK -> `bookings.booking_id` ON DELETE SET NULL
- `lock_token` VARCHAR(64) NOT NULL indexed
- `locked_at`, `expires_at` TIMESTAMPTZ NOT NULL
- `released_at` TIMESTAMPTZ NULL
- `lock_status` VARCHAR(20) NOT NULL default `ACTIVE`
- Checks: status in (`ACTIVE`,`RELEASED`,`EXPIRED`,`CONVERTED`), `expires_at > locked_at`
- Partial unique index: (`show_id`,`seat_id`) where `lock_status='ACTIVE'`
- Indexes: status/expires, show/status etc.

#### `booking_seats`
- `id` BIGINT identity PK
- `booking_id` FK -> `bookings.booking_id` ON DELETE CASCADE
- `show_id` FK -> `shows.show_id` ON DELETE RESTRICT
- `seat_id` FK -> `seats.seat_id` ON DELETE RESTRICT
- `user_id` FK -> `users.id` ON DELETE RESTRICT
- `seat_name_snapshot` VARCHAR(20) NOT NULL
- `category_name_snapshot` VARCHAR(50) NULL
- `seat_price` NUMERIC(12,2) NOT NULL
- `seat_status` VARCHAR(20) NOT NULL default `HELD`
- `created_at` TIMESTAMPTZ NOT NULL
- Unique: (`booking_id`,`seat_id`)
- Checks: price >= 0, status in (`HELD`,`CONFIRMED`,`CANCELLED`,`RELEASED`)
- Partial unique index: (`show_id`,`seat_id`) where `seat_status IN ('HELD','CONFIRMED')`
- Index: (`show_id`,`seat_id`,`seat_status`)

#### `payments`
- `payment_id` BIGINT identity PK
- `booking_id` FK -> `bookings.booking_id` ON DELETE RESTRICT
- `user_id` FK -> `users.id` ON DELETE RESTRICT
- `provider` VARCHAR(50) NOT NULL default `mock`
- `provider_order_id` VARCHAR(100) NULL
- `provider_payment_id` VARCHAR(100) NULL
- `amount` NUMERIC(12,2) NOT NULL
- `currency` VARCHAR(10) NOT NULL default `INR`
- `payment_status` VARCHAR(30) NOT NULL default `INITIATED`
- `idempotency_key` VARCHAR(100) NULL
- `failure_reason` TEXT NULL
- `metadata_json` JSONB (SQLite TEXT variant)
- `created_at`, `updated_at` TIMESTAMPTZ NOT NULL
- Checks: amount >= 0, status in (`INITIATED`,`PENDING`,`AUTHORIZED`,`CAPTURED`,`FAILED`,`CANCELLED`,`REFUNDED`)
- Partial unique indexes on non-null `provider_order_id`, `provider_payment_id`, `idempotency_key`

#### `tickets`
- `ticket_id` BIGINT identity PK
- `booking_id` FK -> `bookings.booking_id` ON DELETE CASCADE
- `user_id` FK -> `users.id` ON DELETE RESTRICT
- `show_id` FK -> `shows.show_id` ON DELETE RESTRICT
- `ticket_reference` VARCHAR(50) UNIQUE NOT NULL
- `qr_code_identifier` VARCHAR(120) UNIQUE NOT NULL
- `issued_at` TIMESTAMPTZ NOT NULL
- `ticket_status` VARCHAR(20) NOT NULL default `ISSUED`
- Check: status in (`ISSUED`,`USED`,`CANCELLED`,`EXPIRED`)

#### `notifications` (`Modules/Notifications/Model.py`)
- `notification_id` BIGINT identity PK
- `user_id` FK -> `users.id` ON DELETE CASCADE
- `type` VARCHAR(50) NOT NULL
- `title` VARCHAR(150) NOT NULL
- `message` TEXT NOT NULL
- `related_booking_id` FK -> `bookings.booking_id` ON DELETE SET NULL
- `is_read` BOOLEAN NOT NULL default false
- `created_at` TIMESTAMPTZ NOT NULL
- `read_at` TIMESTAMPTZ NULL
- Indexes: user/type/related booking and composite (`user_id`,`created_at`), (`user_id`,`is_read`)

### 4.2 Relationships (actual FK/usage)
- `users (1) -> (N) social_accounts`
- `users (1) -> (N) refresh_sessions`
- `users (1) -> (N) theatres` (owner)
- `theatres (1) -> (N) screens`
- `screens (1) -> (N) seat_categories`
- `screens (1) -> (N) seats`
- `seat_categories (1) -> (N) seats` (nullable FK on seat)
- `screens (1) -> (N) shows`
- `movies (1) -> (N) shows`
- `users (1) -> (N) bookings`
- `shows (1) -> (N) bookings`
- `bookings (1) -> (N) booking_seats`
- `bookings (1) -> (N) seat_locks` (nullable booking link; lock also references show/seat/user)
- `bookings (1) -> (N) payments`
- `bookings (1) -> (N) tickets` (service enforces one-ticket-per-booking behavior)
- `users (1) -> (N) notifications`

### 4.3 Constraints/business rules encoded in schema/service
- Partial unique indexes prevent concurrent active seat locks and active held/confirmed booking seats per `(show_id, seat_id)`.
- Payment provider/order/payment/idempotency uniqueness (nullable-safe partial uniques).
- Booking/payment/ticket status domains constrained by CHECKs.
- Movie deletion blocked when referenced by shows (service).
- Screen-seat uniqueness by name and by row/column within screen.
- Theatre-screen name uniqueness within theatre.

---

## 5. Frontend Architecture

### 5.1 Booker frontend (`frontend/`, React + Vite + React Router)
- **Routing/auth:** `BrowserRouter`, route guards (`RequireBooker`, `GuestOnly`), `AuthProvider(kind="booker")`, `BookingFlowProvider` for protected booking area.
- **API access:** centralized `apiFetch` in `services/api.js` with credentialed requests, access token memory store, 401 refresh retry via `/auth/refresh`, auth failure handler.
- **State management:** React Context for auth and booking flow; local component state for page-specific loading/errors/forms.
- **Token handling:** access token stored in memory (`api.js` module variable + context state), refresh token handled via HttpOnly cookie (server-managed), OAuth callback access token parsed from URL hash then cleared from URL.
- **Key user flows/pages:** login/signup, home dashboard, movies listing/filter/search, movie details, show discovery/selection, seat selection & locking, checkout/payment verification (sandbox), payment result, my bookings, booking details/ticket view, notifications, profile/sessions.
- **Backend integration examples:** `/booker/*`, `/bookings/*`, `/notifications/*`, `/auth/profile|sessions|logout*` services.

### 5.2 Owner/Admin frontend (`frontend-owner/`, React + Vite, custom navigation)
- **Routing/navigation:** custom `parseNavFromPath`/`pathForNav` + `history.pushState/replaceState` in `App.jsx`; role-aware route sets for owner and admin.
- **Auth/guards:** `AuthProvider(kind="owner")`; shell enforces session-ready state, role-based rendering (admin portal, owner pending/rejected notices, approved owner app, or "use customer app" notice).
- **Layouts:** `Layout`, `Sidebar`, `Navbar` shell with role-specific nav links.
- **State management:** auth context + local page state (no global router library).
- **Implemented owner features (evident):** dashboard, theatres list/details/create/edit/delete, add screen flow (multi-step pages/components present), movies CRUD UI, shows list/create UI, profile page.
- **Implemented admin features (evident):** overview, owner approvals page/services, users/theatres/movies/shows admin list pages/services.

### 5.3 Frontend-backend communication patterns
- Both apps call the same backend origin (`http://localhost:8001`) with JSON payloads.
- Access token attached as `Authorization: Bearer <token>` by `apiFetch`; refresh uses cookie-auth POST `/auth/refresh` with `credentials: 'include'`.
- Booker booking flow passes `lock_token` between seat lock, summary, checkout, and payment verification steps.
- Booker ticket UI uses `TicketView` + QR utility; ticket retrieval/download endpoints consumed.

---

## 6. Business Workflows (Actual Implementation Trace)

### 6.1 User Signup (Ticket Booker)
- **Frontend:** `frontend/src/pages/SignupPage.jsx` → `useAuth().signup()` (`context/AuthContext.jsx`) → `services/auth.signupBooker()` → `POST /auth/signup`
- **Backend:** `Modules/Auth/Controller.signup` → `Service.signup_user` → `_signup` (role `TICKET_BOOKER`, `APPROVED`) → `Repository.get_user_by_email/create_user` → `Service.issue_session_tokens` (`create_access_token`, `create_refresh_token`, session record) → commit + set refresh cookie
- **Tables:** `users`, `refresh_sessions`
- **Status:** Fully implemented

### 6.2 User Signup (Theatre Owner)
- **Frontend:** `frontend-owner/src/pages/SignupPage.jsx` + owner auth context → `POST /auth/signup/owner`
- **Backend:** `Auth/Controller.signup_owner` → `Service.signup_owner` (role `THEATRE_OWNER`, `PENDING`) → token/session issuance same as booker
- **Tables:** `users`, `refresh_sessions`
- **Status:** Fully implemented (pending approval gate enforced in owner UI and owner APIs)

### 6.3 User Login
- **Frontend:** `frontend/src/pages/LoginPage.jsx` and `frontend-owner/src/pages/LoginPage.jsx` → `services/auth.login()` → `POST /auth/login`
- **Backend:** `Auth/Controller.login` → `Service.login_user` validates user/password (blocks social-only null password), issues access+refresh session, sets refresh cookie
- **Tables:** `users`, `refresh_sessions`
- **Status:** Fully implemented

### 6.4 JWT Authentication & Session Management
- **Frontend:** `services/api.js` stores access token in memory, sends Bearer token, retries once on 401 via `POST /auth/refresh` (cookie-based), clears session on refresh failure. `AuthContext` restores session from refresh cookie and handles OAuth hash token.
- **Backend:** `Middleware/jwtVerify.py` validates access JWT on protected routes (with exemptions). `Auth/Dependencies.get_token` extracts token for endpoint dependencies. `config/Jwt.py` handles access/refresh token creation/decoding and hashing helpers. `Auth/Service` handles refresh rotation, CSRF checks, logout, logout-all, session list/revoke, profile auth.
- **Tables:** `refresh_sessions`, `users`
- **Status:** Fully implemented (core auth/session flows). Some advanced signals (risk assessment) are computed but not strongly enforced.

### 6.5 Theatre Owner Management (Admin approval)
- **Frontend (owner):** owner shell shows pending/rejected notices based on `user.approval_status`; `frontend-owner/src/pages/AdminApprovalsPage.jsx` (present) and `services/auth.js` include `fetchPendingOwners/approveOwner/rejectOwner` hitting `/auth/admin/*`.
- **Frontend (admin module):** `services/admin.js` and admin pages for overview/users/theatres/movies/shows exist.
- **Backend:** `Auth/Controller` admin endpoints (`/auth/admin/pending-owners`, `/approve/{owner_id}`, `/reject/{owner_id}`) + `Auth/Service.get_admin_user`, `Repository.get_pending_owners/set_owner_approval`.
- **Tables:** `users`
- **Status:** Fully implemented (approval APIs and UI integration present)

### 6.6 Theatre Creation / Management
- **Frontend:** `frontend-owner/src/pages/TheatreFormPage.jsx`, `TheatresPage.jsx`, `TheatreDetailsPage.jsx`, `DashboardPage.jsx` use `services/theatres.js` (`/dashboard/stats`, `/theatres`, CRUD).
- **Backend:** `Theatres/Controller` + `Service` + `Repository`; ownership/admin authorization via `Auth.Service.get_current_owner`.
- **Tables:** `theatres`, `screens` (counts/details joins), `shows/movies` for dashboard aggregates
- **Status:** Fully implemented

### 6.7 Screen Management
- **Frontend:** `frontend-owner/src/pages/ScreensPage.jsx`, `AddScreenPage.jsx`, screen designer/info/preview components and `services/screens.js` (`GET/POST /theatres/{id}/screens`, `GET/DELETE /screens/{id}`).
- **Backend:** `Screens/Controller|Service|Repository` with theatre authorization and transactional screen/category/seat creation.
- **Tables:** `screens`, `seat_categories`, `seats`, `theatres`
- **Status:** Fully implemented (backend). Frontend flow is present; detailed designer UX behavior depends on page/component implementations beyond sampled excerpts.

### 6.8 Seat Layout Design & Seat Category Management
- **Frontend:** owner screen creation flow components/pages (`ScreenInfoForm.jsx`, `SeatDesigner.jsx`, `ScreenPreview.jsx`, `seatLayoutUtils.js`, `AddScreenPage.jsx`) prepare payload including categories, seats, layout config.
- **Backend:** `Screens/Schema.ScreenCreate` accepts `categories`, `seats`, `layout_config`; service persists `layout_config` JSON on `screens`, creates `seat_categories` and `seats`.
- **Tables:** `screens.layout_config`, `seat_categories`, `seats`
- **Status:** Fully implemented in backend persistence/API; frontend designer implementation exists in codebase (UI complexity partially sampled).

### 6.9 Movie Management
- **Frontend (owner):** `frontend-owner/src/pages/MoviesPage.jsx`, `MovieFormPage.jsx`, `MovieDetailsPage.jsx`, `services/movies.js` (list/get/create/update/delete).
- **Backend:** `Movies/Controller|Service|Repository` (owner/admin auth required); delete blocked if shows exist.
- **Tables:** `movies`, `shows` (dependency check)
- **Status:** Fully implemented

### 6.10 Movie Show Management
- **Frontend (owner):** `frontend-owner/src/pages/ShowsPage.jsx`, `ShowFormPage.jsx`, `services/shows.js` (list/create). Form loads movies and theatres, then theatre screens.
- **Backend:** `Shows/Controller|Service|Repository` (`GET/POST /shows`) with movie/screen/theatre ownership checks and overlap validation.
- **Tables:** `shows`, `screens`, `theatres`, `movies`
- **Status:** Partially implemented (create/list implemented; no update/delete/cancel endpoints in controller/service/repo)

### 6.11 Movie Ticket Booking - Discovery & Show Selection
- **Frontend:** `BookerHomePage`, `MoviesPage`, `MovieDetailsPage`, `ShowSelectionPage` via `BookingFlowContext` and `services/booker.js`.
  - Home: `GET /booker/home`
  - Movies: `GET /booker/movies`, `GET /booker/movies/filters`
  - Movie detail: `GET /booker/movies/{id}`
  - Show discovery: `GET /booker/movies/{id}/show-discovery`
- **Backend:** `Booker/Controller|Service|Repository` performs availability/bookability computation and theatre/date grouping.
- **Tables:** `movies`, `shows`, `screens`, `theatres`
- **Status:** Fully implemented

### 6.12 Seat Locking and Seat Release
- **Frontend:** `SeatSelectionRoute`/`SeatSelectionPage` in booker app uses `services/bookings.js`:
  - `GET /bookings/shows/{showId}/seats` (layout/availability)
  - `POST /bookings/shows/{showId}/locks` (lock selected seats, receives lock token/expiry)
  - `POST /bookings/shows/{showId}/locks/release` (release)
  - handles lock expiry refresh behavior in UI state
- **Backend:** `Bookings/Controller|Service|Repository|Model` manage seat availability, lock tokens, TTL expiry, active lock constraints, held booking seats, transactional conflict prevention.
- **Tables:** `seat_locks`, `booking_seats`, `bookings`, `seats`, `seat_categories`, `screens`, `shows`, `theatres`
- **Status:** Fully implemented (core logic in backend; UI fully wired)

### 6.13 Booking Confirmation (Checkout initiation)
- **Frontend:** `CheckoutPage.jsx` gets summary (`GET /bookings/summary?lock_token=...`) and creates checkout (`POST /bookings/checkout`) to obtain booking/payment order data.
- **Backend:** `Bookings/Controller.checkout_create_booking` → `Service.checkout_create_booking` validates lock/booking, recalculates amounts server-side, transitions booking to payment-pending state (service logic), creates/reuses payment/order via sandbox provider.
- **Tables:** `bookings`, `booking_seats`, `seat_locks`, `payments`, `shows/screens/theatres` (validation context)
- **Status:** Fully implemented (sandbox checkout/order creation)

### 6.14 Payment Processing
- **Frontend:** `CheckoutPage.jsx` fetches sandbox helpers (`GET /bookings/{id}/payments/sandbox/helpers`) and verifies payment (`POST /bookings/{id}/payments/verify`); `PaymentResultPage.jsx` shows result and can retry (`POST /bookings/{id}/payments/retry`) via app routes/context.
- **Backend:** `Bookings/Controller` payment verify/retry/webhook/helper/status endpoints; `Service` performs signature verification (sandbox), idempotent state transitions, booking confirmation/payment capture/authorization updates, notifications. `Bookings/Payments.py` provides sandbox provider abstraction and signature helpers.
- **Tables:** `payments`, `bookings`, `booking_seats`, `seat_locks`, `tickets`, `notifications`
- **Status:** Fully implemented for **sandbox/test flow**; **live gateway integration not implemented**.

### 6.15 Booking Cancellation
- **Frontend:** `MyBookingsPage.jsx` and `BookingDetailsPage.jsx` call `POST /bookings/{booking_id}/cancel` (with confirmation modals and eligibility display from backend responses).
- **Backend:** `Bookings/Service.cancel_booking` / `_cancel_booking_internal` + controller endpoint enforce eligibility (confirmed, before show start, idempotency), release/cancel seats/locks, mark ticket cancelled, update payment refund status transitions (internal), create notification.
- **Tables:** `bookings`, `booking_seats`, `seat_locks`, `tickets`, `payments`, `notifications`
- **Status:** Fully implemented (business rules per service)

### 6.16 My Bookings
- **Frontend:** `frontend/src/pages/MyBookingsPage.jsx` → `services/bookings.fetchMyBookings()` → `GET /bookings/my`; can open details/ticket/cancel.
- **Backend:** `Bookings/Controller.list_my_bookings` → `Service.list_my_bookings` groups bookings into upcoming/past/cancelled with ticket/payment/cancel metadata.
- **Tables:** `bookings`, `shows`, `screens`, `theatres`, `movies`, `booking_seats`, `tickets`, `payments`
- **Status:** Fully implemented

### 6.17 Ticket retrieval / display / download-data / verification
- **Frontend:** booking details page fetches ticket (`GET /bookings/{id}/ticket`) and displays via `TicketView` + QR utility; download flow uses browser print-to-PDF UX. `services/bookings.js` also includes ticket download-data and verify-ticket API functions.
- **Backend:** ticket get/generate/download-data endpoints and `POST /bookings/tickets/verify` with staff/booker authorization and redemption handling.
- **Tables:** `tickets`, `bookings`, `booking_seats`, `shows`, `screens`, `theatres`, `movies`
- **Status:** Fully implemented in backend; frontend uses retrieval/display and print-based PDF download (not server-generated PDF file endpoint). Ticket verification UI not observed in sampled pages but API/client function exists.

### 6.18 Admin Management
- **Frontend:** owner app admin routes/pages (`AdminOverviewPage`, `AdminApprovalsPage`, `AdminUsersPage`, `AdminTheatresPage`, `AdminMoviesPage`, `AdminShowsPage`) using `/admin/*` and `/auth/admin/*` APIs.
- **Backend:** `Admin/*` read endpoints and `Auth` owner approval endpoints, admin auth checks.
- **Tables:** `users`, `theatres`, `screens`, `movies`, `shows` (aggregates/joins)
- **Status:** Partially implemented (overview/lists/owner approval flows present; broader admin mutation controls beyond owner approval/movie-show-theatre CRUD via existing modules are limited/not exposed as dedicated admin mutation APIs)

---

## 7. Module Implementation Status (Code-verified)

| Area / Module | Status | Evidence / Notes |
|---|---|---|
| Backend config, DB session, JWT helpers | Fully Implemented | `config/database.py`, `config/Jwt.py`, env-driven secrets/expiry |
| Global JWT middleware | Fully Implemented | `Middleware/jwtVerify.py` with route exemptions |
| Auth signup/login/logout/refresh/sessions/profile | Fully Implemented | `Modules/Auth/*`, controllers/services/repos, cookie + rotation + CSRF checks |
| Social auth (Google) start/callback/link/create | Fully Implemented (provider-limited) | `Auth/Social*.py`, Authlib/Google config, redirect flow; only Google provider configured |
| Owner approval (admin endpoints) | Fully Implemented | `/auth/admin/pending-owners|approve|reject` |
| Theatre CRUD + dashboard stats | Fully Implemented | `Modules/Theatres/*`, owner/admin scoping |
| Screen/category/seat creation & retrieval | Fully Implemented | `Modules/Screens/*`, layout config persistence |
| Movie CRUD (owner/admin APIs) | Fully Implemented | `Modules/Movies/*`, show-reference delete guard |
| Show list/create (owner/admin APIs) | Partially Implemented | List/create/overlap check implemented; no edit/delete endpoints |
| Booker discovery APIs | Fully Implemented | `Modules/Booker/*` rich filtering/discovery logic |
| Seat availability/locking/release | Fully Implemented | `Modules/Bookings/*` models/repos/service/controller |
| Checkout/payment summary/order/verify/retry/webhook | Fully Implemented (Sandbox) | `Bookings/Payments.py` sandbox-only; no live provider integration |
| Ticket issuance/retrieval/download-data/verification | Fully Implemented (backend) | Ticket generation/state sync/verify endpoint; frontend uses retrieval and browser print-PDF flow |
| Booking cancellation/refund state transition | Fully Implemented (internal state) | Service updates booking/ticket/locks/payment refund status; not an external refund processor integration |
| Notifications (booker in-app) | Fully Implemented | `Modules/Notifications/*`, generated by booking flows |
| Admin overview and paginated read APIs | Fully Implemented | `Modules/Admin/*` |
| Admin UI (owner frontend app) | Partially Implemented | Pages/services/routes exist for overview/approvals/users/theatres/movies/shows; depth depends on UI/page completeness but APIs for reads/approvals exist |
| Booker frontend app (core customer journey) | Fully Implemented (prototype scope) | Routes/pages/services cover discovery→seat lock→checkout→payment result→bookings/ticket/profile/notifications |
| Owner frontend app (core owner management) | Partially Implemented to Fully Implemented by area | Theatre/screen/movie/show/profile flows present; shows limited to create/list by backend |
| Automated tests (backend) | Partially Implemented / Requires Verification for execution | Test files exist for major flows, but execution not run in this analysis environment |

### Items requiring verification (not conclusively proven by static read alone)
- End-to-end runtime behavior against a configured PostgreSQL database and populated seed data.
- Full UI completeness/styling/edge-case handling in very large/truncated frontend page components (e.g. seat designer internals).
- Test suite pass/fail status in the current environment.

---

## 8. Important Technical Details

- **Tech stack:** FastAPI, SQLAlchemy, PostgreSQL dialect features (JSONB, partial unique indexes), Pydantic v2, python-jose, pwdlib, Authlib, Starlette SessionMiddleware; React 19, Vite 8, React Router (booker only).
- **Ports/origins:** backend `:8001`; booker frontend `:5173`; owner frontend `:5174`; hardcoded API base URLs in frontend service clients.
- **Auth token strategy:** short-lived access JWT + HttpOnly refresh cookie session (DB-backed, rotated). Frontend stores access token in memory only.
- **CSRF mitigation for cookie refresh/logout:** origin/referer allowlist checks in auth service for cookie-authenticated endpoints.
- **Seat/booking consistency:** DB constraints (partial uniques/checks) + service/repository transactional logic and locking patterns to prevent double booking/active duplicate locks.
- **Pricing integrity:** backend calculates subtotal/tax/convenience/total; frontend displays backend-calculated amounts.
- **Payment model:** provider abstraction with sandbox-only implementation; webhook endpoint exists but signature/event handling is sandbox-oriented; no real card/credential storage.
- **Notifications:** in-app DB notifications for booker; generated on key booking/payment/cancellation events (best-effort in service).
- **Migrations:** SQL files provided for schema parity/setup; not auto-applied by app startup.
- **Security/config caveats:** default admin seed credentials configurable/env-driven; secrets expected in environment; hardcoded localhost URLs in frontends; no production deployment hardening described in code.

---

## 9. Frontend-Backend Integration Summary (Selected)

| Frontend area | Key component/page(s) | Service calls | Backend endpoints | Main tables involved |
|---|---|---|---|---|
| Booker auth | Login/Signup/AuthContext | `auth.login/signupBooker`, `api.refreshAccessToken`, `auth.fetchHome` | `/auth/login`, `/auth/signup`, `/auth/refresh`, `/auth/home` | `users`, `refresh_sessions` |
| Owner auth & approval gate | Owner Login/Signup/Shell/Notice | owner signup/login/home, admin approvals | `/auth/signup/owner`, `/auth/login`, `/auth/home`, `/auth/admin/*` | `users`, `refresh_sessions` |
| Booker discovery | Home/Movies/MovieDetails/ShowSelection | `booker.*` | `/booker/home`, `/booker/movies*`, `/booker/movies/{id}/show-discovery` | `movies`, `shows`, `screens`, `theatres` |
| Seat selection & lock | SeatSelectionRoute/Page | `bookings.fetchShowSeatLayout/lockShowSeats/releaseShowSeatLocks` | `/bookings/shows/{id}/seats`, `/locks`, `/locks/release` | `seat_locks`, `booking_seats`, `bookings`, `seats`, `shows` |
| Checkout & payment | CheckoutPage/PaymentResultPage | summary/checkout/verify/retry/sandbox helpers/status | `/bookings/summary`, `/checkout`, `/payments/verify`, `/payments/retry`, `/payments/sandbox/helpers`, `/bookings/{id}` | `bookings`, `payments`, `booking_seats`, `tickets`, `notifications` |
| Bookings & tickets | MyBookings/BookingDetails/TicketView | `fetchMyBookings/fetchBookingDetails/fetchTicket/cancelBooking` | `/bookings/my`, `/bookings/{id}/details`, `/bookings/{id}/ticket`, `/bookings/{id}/cancel` | `bookings`, `tickets`, `payments`, `shows`, `theatres`, `movies` |
| Booker profile/sessions/notifications | ProfilePage/NotificationsPage/Navbar badge | `auth.fetchProfile/updateProfile/fetchSessions/revokeSession/logoutAll`, `notifications.*` | `/auth/profile`, `/auth/sessions*`, `/auth/logout-all`, `/notifications*` | `users`, `refresh_sessions`, `notifications` |
| Owner theatres/screens/movies/shows | Owner dashboard/pages | `theatres.js`, `screens.js`, `movies.js`, `shows.js` | `/dashboard/stats`, `/theatres*`, `/theatres/{id}/screens*`, `/screens/*`, `/movies*`, `/shows` | `theatres`, `screens`, `seat_categories`, `seats`, `movies`, `shows` |
| Admin portal | Admin pages in owner app | `admin.js`, auth admin approval APIs | `/admin/overview|users|theatres|movies|shows`, `/auth/admin/*` | `users`, `theatres`, `screens`, `movies`, `shows` |

---

## 10. Limitations / Not Implemented / Ambiguities

- **Live payments:** not implemented (sandbox provider only). "Refund" handling is internal payment/booking state transition in service, not external gateway settlement proof.
- **Show lifecycle management:** no show update/delete/cancel API endpoints despite status fields and UI concepts.
- **Server-side PDF ticket file generation:** not evidenced; frontend uses print-to-PDF flow.
- **Role coverage in UI:** admin and owner share `frontend-owner` app shell with role-based views; separate booker app exists for ticket bookers.
- **Potential schema/runtime drift risk:** ORM models and SQL migrations both exist; app startup does not auto-migrate.
- **Unclear/verify:** some page-level UX details and complete behavior in large frontend files were not exhaustively inspected line-by-line in this pass, but route/service/backend integration is verified from source. 

This document reflects implemented behavior evidenced in source code at analysis time. Where implementation is partial or uncertain, it is explicitly marked.