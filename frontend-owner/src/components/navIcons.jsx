// Small stroke-based icon set shared by the sidebar, navbar, dashboard and screens page.
const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.8" />
      <rect x="14" y="3" width="7" height="5" rx="1.8" />
      <rect x="14" y="12" width="7" height="9" rx="1.8" />
      <rect x="3" y="16" width="7" height="5" rx="1.8" />
    </>
  ),
  theatres: <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M10 11h4" />,
  screens: (
    <>
      <rect x="2.5" y="4" width="19" height="12" rx="2.2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  movies: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  shows: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.2" />
      <path d="M3 10h18M8 3v4M16 3v4M8 14.5h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2.2.7 3.5 2.4 3.5 5.2" />
    </>
  ),
  approvals: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5" />,
  logout: <path d="M14 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M16 8l4 4-4 4M20 12H10" />,
  collapse: <path d="M15 6l-6 6 6 6" />,
  expand: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  seat: (
    <>
      <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
      <path d="M4 13a2 2 0 0 1 4 0v2h8v-2a2 2 0 0 1 4 0v5H4zM7 21v-3M17 21v-3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
}

// `size` is in design px; it is emitted in rem so icons follow the global UI
// scale (--ui-scale in index.css) together with everything else.
export function Icon({ name, size = 20, className = '' }) {

  const dim = `${size / 16}rem`

  return (
    <svg
      className={className}
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] || null}
    </svg>
  )
}

export function initialsOf(name = '') {

  const parts = String(name).trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
