# MoviePass Booker Frontend (`gmoviepass/frontend`)

React + Vite single-page app for the booker (ticket-booker) experience, aligned with the reference implementation.

## Stack
- React 19, Vite
- No router library; view switching is state-driven in `src/App.jsx`
- API client in `src/services/api.js` (base URL `http://localhost:8000`, `credentials: 'include'`, in-memory access token, refresh-once retry on 401 for applicable requests)

## Scripts
```bash
npm install
npm run dev      # Vite dev server (port 5173, strict)
npm run build
npm run preview
npm run lint
```

## Implemented behavior
- Email/password login and booker signup
- Google social sign-in redirect initiation (`/auth/{provider}?app=booker`) and hash-callback handling (`#access_token` / `#error`)
- Session restore on load via refresh cookie + `/auth/home`
- Auth-gated shell: booker home view; non-booker roles shown a notice directing to Owner Portal (`http://localhost:5174`)
- Logout and refresh/session handling integrated with backend auth contracts

## Configuration notes
- Backend URL and dev port are fixed in code/config (`http://localhost:8000`, port `5173`). Ensure backend CORS/front-end origins and OAuth redirect configuration match your local setup.
- No movie browsing, booking, or ticketing features are implemented (not present in reference scope).

## Limitations
This app reflects the implemented/parity auth shell only. Do not expect unimplemented domain features beyond what the reference provides.
