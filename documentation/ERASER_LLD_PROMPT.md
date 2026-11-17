# Eraser AI Prompt: MoviePass Low-Level Design (LLD) Generation

Use the following prompt in Eraser AI to generate a professional, implementation-accurate LLD for the MoviePass project.

---

## Prompt (copy-paste into Eraser AI)

You are a senior software architect and technical documentation specialist. Generate a detailed **Low-Level Design (LLD)** for the **MoviePass** web application based on the **actual implemented codebase** described below. 

### Critical instructions
- **Do not invent** APIs, classes, methods, database tables, columns, relationships, services, or workflows that are not listed as implemented.
- Clearly distinguish **Implemented (Existing)**, **Partially Implemented**, and **Planned/Not Implemented** functionality in every relevant section and diagram note.
- Prefer **actual names** from the codebase (modules, files, endpoints, schemas, models, tables, statuses) where provided.
- If a detail is unclear from the provided implementation summary, explicitly label it as **"Requires Verification"** rather than guessing.
- Produce professional, readable technical documentation suitable for engineering review.
- Use diagrams that reflect the real architecture and flows (not a generic movie-booking template).

---

## 1) Project context (actual implementation)

MoviePass is a movie ticketing platform prototype with:
- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL (with JSONB and partial indexes used), JWT authentication (access token + DB-managed refresh session cookie), Pydantic schemas.
- **Frontend 1 (Booker SPA):** React 19 + Vite + React Router (`frontend/`, port 5173) for ticket bookers.
- **Frontend 2 (Owner/Admin SPA):** React 19 + Vite with custom path/history navigation (`frontend-owner/`, port 5174) for theatre owners and admins.
- **API base URL (hardcoded in both frontends):** `http://localhost:8000`

### User roles
- `TICKET_BOOKER` (approved customer/booker)
- `THEATRE_OWNER` (signup creates pending approval; must be approved for owner operations/UI access)
- `ADMIN` (seeded/configurable; approves/rejects owners, views admin read dashboards/lists; can bypass some ownership checks in backend services)

### Runtime/cross-cutting backend behavior
- `backend/main.py`: FastAPI app with lifespan admin seeding, CORS, Starlette `SessionMiddleware` (OAuth), custom JWT middleware, router registration.
- `Middleware/jwtVerify.py`: validates access JWT from `Authorization: Bearer` or `?token=`; exempts OPTIONS, login/signup, refresh/logout, docs/openapi/root/health, `/auth/google*`, `/bookings/payments/webhook`.
- `Modules/Auth/Dependencies.get_token`: token extraction (Bearer/header/query fallback) for endpoint dependencies.
- `config/Jwt.py`: password hashing (pwdlib), access/refresh JWT issue/decode, expiry parsing, refresh token hash helpers, refresh cookie security based on environment.
- `config/database.py`: SQLAlchemy engine/session/base from `DATABASE_URL`.
- **Refresh session model:** DB-managed refresh sessions (`refresh_sessions`) with HttpOnly refresh cookie, rotation, revoke/logout/logout-all, session listing/revocation, CSRF origin/referer checks for cookie-auth refresh/logout.
- **Payments:** provider abstraction with **sandbox-only** implementation (`Modules/Bookings/Payments.py`); no live gateway integration.
- **No raw card data storage** in backend models.

---

## 2) Backend architecture and modules (actual)

### Layering pattern (most modules)
`Controller` (FastAPI router) → `Service` (business logic/auth/validation/orchestration/transactions) → `Repository` (SQLAlchemy queries) + `Schema` (Pydantic request/response) + `Model` (SQLAlchemy entities)

### Modules and responsibilities

#### A. Auth (`backend/Modules/Auth/*`)
- **Implemented:** ticket booker signup, theatre owner signup (pending), login, refresh token rotation, logout, logout-all, active session listing, revoke specific session, profile get/update (name/phone), home, admin pending-owner list/approve/reject, Google OAuth start/callback (Authlib), social account linking/creation logic.
- **Key files/classes/functions (representative):** `Controller` routes under `/auth`; `Service` (`signup_user`, `signup_owner`, `login_user`, `refresh_user_session`, `logout_user_session`, `logout_all_user_sessions`, `list_user_sessions`, `revoke_user_session`, `get_home`, `get_admin_user`, `get_current_owner`, etc.); `Repository`; `Dependencies.get_token`; `Social.py` / `SocialService.py`.
- **Status:** Implemented (Google provider configured; other providers not evidenced).

#### B. Theatres & Dashboard (`backend/Modules/Theatres/*`)
- **Implemented:** dashboard stats, list/create/get/update/delete theatres with owner/admin access scoping.
- **Also contains domain models for:** `Movie`, `Theatre`, `Screen`, `SeatCategory`, `Seat`, `Show` (shared by other modules).
- **Endpoints:** `GET /dashboard/stats`, `GET/POST /theatres`, `GET/PUT/DELETE /theatres/{theatre_id}`.
- **Status:** Implemented.

#### C. Screens & Seat Layout Persistence (`backend/Modules/Screens/*`)
- **Implemented:** create screen with categories and seats (transactional), list screens by theatre, get screen details with enriched seats/categories, delete screen.
- **Features:** supports categorized or default pricing mode, stores `layout_config` JSON in `screens`, validates theatre ownership/admin access.
- **Endpoints:** `POST/GET /theatres/{theatre_id}/screens`, `GET/DELETE /screens/{screen_id}`.
- **Status:** Implemented.

#### D. Movies (`backend/Modules/Movies/*`)
- **Implemented:** list/search/get/create/update/delete movies for authenticated owner/admin users.
- **Business rule:** cannot delete movie referenced by existing shows.
- **Endpoints:** `GET/POST /movies`, `GET/PUT/DELETE /movies/{movie_id}`.
- **Status:** Implemented.

#### E. Shows (`backend/Modules/Shows/*`)
- **Implemented:** list shows (owner-scoped/admin), create show with movie/screen/theatre ownership checks and basic same-screen/date time-overlap validation.
- **Endpoints:** `GET/POST /shows`.
- **Status:** Partially Implemented (no update/delete/cancel APIs).

#### F. Booker Discovery (`backend/Modules/Booker/*`)
- **Implemented:** authenticated booker/discovery read APIs: home sections, movie list/filter/sort/pagination, filters, movie detail, movie shows, rich show discovery grouped by theatre/date with bookability and optional distance sorting.
- **Endpoints:** `/booker/home`, `/booker/movies`, `/booker/movies/filters`, `/booker/movies/{movie_id}`, `/booker/movies/{movie_id}/shows`, `/booker/movies/{movie_id}/show-discovery`.
- **Status:** Implemented.

#### G. Bookings, Seat Locks, Payments, Tickets (`backend/Modules/Bookings/*`)
- **Implemented:** show seat layout/availability, seat lock acquire/release with TTL, booking summary, checkout/payment order creation, payment verify/retry/webhook, sandbox helper endpoint, booking status/details, my bookings, booking cancellation, ticket generate/retrieve/download-data, ticket verify/redeem endpoint.
- **Key mechanics:** server-side pricing/tax/fee calculation, DB constraints and transactional locking/conflict checks, stale lock expiry handling, idempotent-ish payment confirmation/ticket issuance behavior, notifications on key events.
- **Payments:** sandbox/test provider only; webhook and verification are sandbox-oriented.
- **Endpoints:** under `/bookings` including `/shows/{show_id}/seats`, `/shows/{show_id}/locks`, `/shows/{show_id}/locks/release`, `/summary`, `/checkout`, `/my`, `/{booking_id}`, `/{booking_id}/details`, `/{booking_id}/cancel`, `/{booking_id}/ticket`, `/{booking_id}/ticket/download`, `/{booking_id}/payments/verify`, `/{booking_id}/payments/retry`, `/{booking_id}/payments/sandbox/helpers`, `/payments/webhook`, `/tickets/verify`.
- **Status:** Implemented (sandbox payments; internal refund state transitions on cancellation, not external settlement integration).

#### H. Notifications (`backend/Modules/Notifications/*`)
- **Implemented:** list notifications, unread count, mark read, mark all read for ticket bookers; booking flow creates notifications.
- **Endpoints:** `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- **Status:** Implemented.

#### I. Admin (`backend/Modules/Admin/*`)
- **Implemented:** admin overview and paginated read lists for users/theatres/movies/shows.
- **Endpoints:** `GET /admin/overview`, `/admin/users`, `/admin/theatres`, `/admin/movies`, `/admin/shows`.
- **Status:** Implemented for read/overview APIs (broader admin mutation beyond owner approvals and shared domain CRUD is limited).

---

## 3) Frontend architecture (actual)

### Booker SPA (`frontend/`)
- **Tech:** React 19, Vite, `react-router-dom`
- **State:** `AuthContext` (session/token/user/OAuth redirect restore), `BookingFlowContext` (discovery + booking flow state)
- **Routing guards:** `RequireBooker`, `GuestOnly`
- **API layer:** `services/api.js` (`apiFetch`, memory access token, credentialed refresh retry), plus `auth.js`, `booker.js`, `bookings.js`, `notifications.js`
- **Key pages/components:** `LoginPage`, `SignupPage`, `BookerHomePage`, `MoviesPage`, `MovieDetailsPage`, `ShowSelectionPage`, `SeatSelectionPage`, `CheckoutPage`, `PaymentResultPage`, `MyBookingsPage`, `BookingDetailsPage`, `NotificationsPage`, `BookerProfilePage`, `Navbar`, `MovieCard`, `MovieSection`, `TicketView`, `SocialButtons`
- **Implemented user journey:** login/signup/session restore → browse/search movies → view movie/show discovery → select seats & lock → checkout/summary → sandbox payment verify/retry → booking/ticket views and cancellation → notifications/profile/sessions
- **Status:** Implemented for core booker flow (prototype/sandbox payment UX).

### Owner/Admin SPA (`frontend-owner/`)
- **Tech:** React 19, Vite, custom navigation (`App.jsx` path parsing + history API), no React Router
- **State/auth:** `AuthContext` (kind owner), role/approval-based shell rendering
- **API layer:** `services/api.js`, `auth.js`, `theatres.js`, `screens.js`, `movies.js`, `shows.js`, `admin.js`
- **Owner pages/features:** Dashboard, Theatres (list/details/create/edit/delete), Screens list and Add Screen flow (`AddScreenPage`, `ScreenInfoForm`, `SeatDesigner`, `ScreenPreview`, `seatLayoutUtils`), Movies (list/details/create/edit/delete), Shows (list/create), Profile
- **Admin pages/features:** Overview, Owner Approvals, Users, Theatres, Movies, Shows
- **Status:** Partially to fully implemented by feature area (core management UIs present; backend constraints apply, e.g. show edit/delete not implemented).

---

## 4) Database entities and relationships (actual)

### Core auth/session
- **users** (`id`, `name`, `email` unique, `password` nullable, `role`, `phone_no` nullable, `approval_status`)
- **social_accounts** (`id`, `user_id` FK users, `provider`, `provider_user_id`, `provider_email`, `created_at`; unique provider+provider_user_id)
- **refresh_sessions** (`id`, `user_id` FK users, `refresh_token_hash` unique/jti, `ip_address`, `user_agent`, `device_name`, `created_at`, `expires_at`, `last_used_at`, `revoked_at`, `is_active`)

### Catalog/theatre operations
- **movies** (`movie_id`, `movie_name`, metadata fields, timestamps)
- **theatres** (`theatre_id`, `owner_id` FK users, name/address/location/contact/status/timestamps)
- **screens** (`screen_id`, `theatre_id` FK theatres, name/number/rows/cols/category flags/default price/`layout_config` JSON/status/timestamps; unique theatre+screen_name)
- **seat_categories** (`category_id`, `screen_id` FK screens, name/price/color/timestamps; unique screen+category_name)
- **seats** (`seat_id`, `screen_id` FK screens, `category_id` FK nullable, `seat_name`, `row_number`, `column_number`, `is_active`, timestamps; uniques on screen+seat_name and screen+row+col)
- **shows** (`show_id`, `screen_id` FK screens, `movie_id` FK movies, `show_date`, `start_time`, `end_time`, `status`, timestamps; check end_time > start_time)

### Booking/payment/ticketing
- **bookings** (`booking_id`, `booking_reference` unique, `user_id` FK users, `show_id` FK shows, `booking_status`, amounts subtotal/tax/convenience/total, currency, lock/confirm/cancel timestamps, created/updated)
- **seat_locks** (`id`, `show_id` FK shows, `seat_id` FK seats, `user_id` FK users, `booking_id` FK bookings nullable, `lock_token`, lock/expire/release times, `lock_status`; partial unique active lock per show+seat)
- **booking_seats** (`id`, `booking_id` FK bookings, `show_id` FK shows, `seat_id` FK seats, `user_id` FK users, snapshots name/category/price, `seat_status`, created_at; partial unique active held/confirmed per show+seat)
- **payments** (`payment_id`, `booking_id` FK bookings, `user_id` FK users, provider/order/payment ids, amount/currency/status/idempotency/failure/metadata_json/timestamps; partial uniques for non-null identifiers)
- **tickets** (`ticket_id`, `booking_id` FK bookings, `user_id` FK users, `show_id` FK shows, `ticket_reference` unique, `qr_code_identifier` unique, issued_at, `ticket_status`)

### Notifications
- **notifications** (`notification_id`, `user_id` FK users, `type`, `title`, `message`, `related_booking_id` FK bookings nullable, `is_read`, `created_at`, `read_at`)

### Relationship summary
- User 1-N SocialAccount, RefreshSession, Theatre, Booking, Notification
- Theatre 1-N Screen; Screen 1-N SeatCategory, Seat, Show; SeatCategory 1-N Seat (optional)
- Movie 1-N Show; Show 1-N Booking/SeatLock/BookingSeat/Ticket
- Booking 1-N BookingSeat, Payment, Ticket, SeatLock (linked), Notification (optional relation)

---

## 5) Actual business workflows to document (with traces)

For each workflow, create a **detailed flow explanation and sequence/activity diagram** showing: frontend component/page → frontend service/API call → backend controller → service → repository/model/table interactions. Mark status (Implemented/Partial/Planned).

1. **User Signup (Ticket Booker)**
   - `SignupPage` → `auth.signupBooker` → `POST /auth/signup` → `Auth.Controller.signup` → `Service.signup_user/_signup` → `Repository.create_user` → token/session issue → `users`,`refresh_sessions`
2. **User Signup (Theatre Owner, pending approval)**
   - Owner `SignupPage` → `POST /auth/signup/owner` → `Service.signup_owner` → `users`,`refresh_sessions` (status PENDING)
3. **User Login**
   - `LoginPage` → `POST /auth/login` → `Service.login_user` (password verify, reject social-only) → session issue
4. **JWT Auth / Refresh / Session Lifecycle**
   - Access token in memory; 401 triggers `POST /auth/refresh` (cookie) with CSRF checks and rotation; middleware/dependency token validation; logout/logout-all/session list/revoke endpoints
5. **Google OAuth Social Login (Implemented for Google)**
   - `/auth/{provider}` start → Authlib redirect/callback → profile fetch/verify email → link or create/login user → set refresh cookie + redirect with access token fragment
6. **Theatre Owner Approval (Admin)**
   - Admin approvals UI/API → `/auth/admin/pending-owners|approve|reject` → `Auth.Service.get_admin_user` + repository status updates on `users`
7. **Theatre Creation/Management (Owner/Admin scoped)**
   - Owner theatre pages/services → `/dashboard/stats`, `/theatres` CRUD → `Theatres` controller/service/repo → `theatres` (+ aggregates from related tables)
8. **Screen Management + Seat Layout/Category Persistence**
   - Owner add-screen flow (info/designer/preview) → `POST /theatres/{id}/screens` and screen read/delete APIs → `Screens.Service.create_screen` transactional creation of `screens`,`seat_categories`,`seats` with `layout_config`
9. **Movie Management**
   - Owner movie pages/services → `/movies` CRUD → `Movies` module → `movies` (delete guard against `shows`)
10. **Show Management**
   - Owner show pages/services → `GET/POST /shows` → `Shows` module validation/overlap checks → `shows`
   - **Mark as Partially Implemented** (no edit/delete/cancel endpoints)
11. **Booker Movie Discovery & Show Discovery**
   - Home/Movies/MovieDetails/ShowSelection → `/booker/*` APIs → `Booker` module queries/aggregation logic → `movies`,`shows`,`screens`,`theatres`
12. **Seat Layout Retrieval, Seat Locking, Lock Release**
   - Seat selection page → `/bookings/shows/{showId}/seats`, `/locks`, `/locks/release` → `Bookings` service/repo transactional lock management → `seat_locks`,`booking_seats`,`bookings`,`seats`
13. **Booking Summary & Checkout (Order Creation)**
   - Checkout page → `/bookings/summary?lock_token=...`, `/bookings/checkout` → server-side recalculation/validation, payment-pending transition, sandbox order create/reuse → `bookings`,`booking_seats`,`payments`
14. **Payment Processing (Sandbox) & Confirmation**
   - Checkout/Payment Result → `/payments/sandbox/helpers`, `/payments/verify`, `/payments/retry`, webhook endpoint exists → signature verification and idempotent confirmation/ticket issuance/notifications → `payments`,`bookings`,`tickets`,`notifications`
   - **Mark live payment gateway as Planned/Not Implemented; sandbox as Implemented**
15. **Booking Cancellation & Refund State Handling**
   - My bookings/booking details cancel actions → `POST /bookings/{id}/cancel` → eligibility checks, seat/lock release, ticket cancel, booking cancel, payment refund-state transition (internal), notification → `bookings`,`booking_seats`,`seat_locks`,`tickets`,`payments`,`notifications`
16. **My Bookings, Booking Details, Ticket Retrieval/Download-Data**
   - Bookings pages → `/bookings/my`, `/bookings/{id}/details`, `/bookings/{id}/ticket`, `/bookings/{id}/ticket/download` → grouped/status-enriched responses and ticket payloads
   - Frontend download is browser print-to-PDF flow (not server-generated PDF file) — label accordingly
17. **Ticket Verification/Redemption (Backend/API capability)**
   - `POST /bookings/tickets/verify` with staff/booker authorization rules and optional redemption (`USED`) — **Implemented API**, **frontend verification UI not evidenced as a dedicated page in sampled analysis (Requires Verification)**
18. **Notifications & Profile/Session Management (Booker)**
   - Notifications page/navbar badge + profile page → `/notifications*`, `/auth/profile`, `/auth/sessions*`, `/auth/logout-all` → `notifications`,`users`,`refresh_sessions`

---

## 6) Required LLD sections and diagrams to generate

Generate the LLD with the following sections. For each, explicitly indicate **Existing vs Partial vs Planned** elements.

### 1. System Overview
- Purpose, users/roles, deployment/runtime components (backend, booker SPA, owner/admin SPA), key capabilities and limitations.

### 2. System Architecture
- **Diagram(s):** high-level system architecture / container diagram and backend layered architecture diagram.
- Show frontend apps, FastAPI app, middleware, auth/session mechanisms, PostgreSQL, sandbox payment provider abstraction, OAuth provider (Google).

### 3. Module-Level Design
- **Diagram(s):** backend module/component diagram.
- Document each module (`Auth`, `Theatres`, `Screens`, `Movies`, `Shows`, `Booker`, `Bookings`, `Notifications`, `Admin`, `config`, `Middleware`) with responsibilities, key files, and dependencies/interactions.

### 4. Component Diagram
- **Diagram(s):** frontend-backend component interaction diagram (separate views for Booker SPA and Owner/Admin SPA recommended).
- Include contexts/state stores, service clients, route/page groups, and backend API groups.

### 5. UML Class Diagrams
- **Diagram(s):** at least
  - Domain/data model class diagram (SQLAlchemy models/entities and relationships)
  - Service/controller/repository class diagram for key modules (**Auth**, **Bookings**, **Screens/Theatres/Shows/Movies**, **Booker/Notifications/Admin** can be separate if clearer)
- Include key attributes, methods/functions, and associations based on actual code names where provided.

### 6. Database ER Diagram
- **Diagram:** ERD with PK/FK/unique/check/partial-unique constraints called out where important.
- Cover: `users`, `social_accounts`, `refresh_sessions`, `movies`, `theatres`, `screens`, `seat_categories`, `seats`, `shows`, `bookings`, `seat_locks`, `booking_seats`, `payments`, `tickets`, `notifications`.
- Highlight concurrency-control constraints for seat locking/booking (partial unique indexes).

### 7. API Design
- Provide endpoint inventory tables grouped by module with method, path, auth/role expectations, purpose, request/response schema highlights, and implementation status.
- Include all endpoints listed in section 2 above (Auth, Theatres, Screens, Movies, Shows, Booker, Bookings, Notifications, Admin, root/health).

### 8. Sequence Diagrams
Create separate sequence diagrams for complex flows:
- User signup/login + refresh/session restore/logout
- Google OAuth login callback flow
- Owner signup + admin approval flow
- Theatre/screen/seat layout creation flow
- Movie/show management flow
- Booker discovery and show selection flow
- Seat selection/lock/release flow
- Booking summary + checkout + sandbox payment verification/confirmation flow
- Payment retry/webhook (sandbox) flow
- Booking cancellation and refund-state update flow
- Ticket generation/retrieval/verification flow
- Notifications and profile/session management flows

### 9. Activity Diagrams
Create activity diagrams for:
- End-to-end ticket booking journey (booker)
- Seat lock lifecycle and expiry handling
- Payment verification and booking confirmation decision flow (sandbox)
- Booking cancellation eligibility/refund-state flow
- Owner approval and access gating flow

### 10. Authentication and Authorization Design
- Document access JWT, refresh cookie session architecture, token extraction/validation, middleware exemptions, CSRF checks for cookie-auth endpoints, role/approval checks (`TICKET_BOOKER`, `THEATRE_OWNER`, `ADMIN`), and frontend token handling (memory access token + cookie refresh).

### 11. Booking and Seat Locking Design
- Document seat availability computation, lock token lifecycle, TTL/expiry, `seat_locks`/`booking_seats`/`bookings` state transitions, DB constraints, conflict prevention, and server-side pricing/totals.

### 12. Payment Workflow Design
- Document sandbox payment provider abstraction, order creation/reuse, verification, retry, webhook handling, idempotency/duplicate protection, booking confirmation and ticket issuance triggers, and explicit **non-implementation of live gateway**.

### 13. Error Handling Design
- Document representative validation/auth/authorization/conflict/not-found/error responses and transactional rollback behavior (e.g. invalid credentials, unapproved owner access, seat conflicts, lock expiry, invalid payment signature, delete-movie-with-shows constraint).

### 14. Database Constraints and Relationships
- Summarize PK/FK/unique/check/partial-unique indexes and how they enforce business invariants (session uniqueness, active lock uniqueness, active booking-seat uniqueness, payment id uniqueness/idempotency, ticket uniqueness, show time check).

---

## 7) Existing vs Planned/Partial status summary (must be reflected in diagrams/notes)

### Implemented (Existing)
- Core auth (JWT + refresh sessions), Google OAuth, profile/sessions, owner approvals
- Theatre CRUD/dashboard, screen/seat layout persistence, movie CRUD, show list/create
- Booker discovery APIs and UI flow
- Seat locking/release, checkout, sandbox payment verify/retry/webhook handling, booking status/details/my bookings
- Ticket issuance/retrieval/verification backend and ticket display in booker UI
- Booking cancellation with internal refund-state transition
- Notifications APIs and UI integration
- Admin overview/read list APIs and admin UI pages/routes in owner app

### Partially Implemented / Limited
- Show management limited to list/create (no edit/delete/cancel APIs)
- Admin management primarily read/overview + owner approvals (not full admin mutation suite)
- Frontend ticket download implemented as browser print-to-PDF flow (not server-generated PDF endpoint)
- Some UI implementation details require verification (large/complex components), though integrations/routes/services are present

### Planned / Not Implemented
- Live payment gateway integration and external refund settlement processing
- Additional OAuth providers beyond Google (not evidenced)
- Production hardening/deployment automation (not part of LLD scope unless explicitly requested)

---

## 8) Output quality requirements
- Use clear headings, consistent notation, and readable diagram labels.
- Prefer separate diagrams for complex domains (Auth/Sessions, Booking/Seat Locking, Payment/Ticketing, Theatre/Screen/Show catalog).
- Include legends/notes for statuses and concurrency/state transitions where applicable.
- Ensure every major workflow includes the frontend-to-backend-to-database trace requested above.
- Produce the final response as a complete LLD document with embedded/generated diagrams in Eraser AI. 

--- 

**End of prompt**