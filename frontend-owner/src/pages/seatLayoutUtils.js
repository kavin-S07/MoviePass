// Shared helpers for the Add Screen flow (SeatDesigner + ScreenPreview).

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Same labelling as before: A..Z, then AA, AB, ...
// (layout_config.row_labels sent to the backend depends on this, do not change.)
export function rowLabel(index) {

  if (index < 26) return LETTERS[index]

  const first = Math.floor(index / 26) - 1

  return LETTERS[first] + LETTERS[index % 26]
}

export const SEAT_GAP = 6
export const MIN_SEAT = 20
export const MAX_SEAT = 48
export const DEFAULT_SEAT = 34

export const seatKey = (r, c) => `${r}-${c}`

export function seatMetrics(seat) {

  return {
    seat,
    aisle: Math.round(seat * 0.8),
    label: 36,
    font: Math.max(7, Math.round(seat * 0.3)),
  }
}

// All sizes in this file are "design px" (1 design px = 1/16 rem). They are
// handed to CSS as rem so the seat map follows the global UI scale (--ui-scale
// in index.css) like every other component.
const rem = (designPx) => `${designPx / 16}rem`

// Actual screen px per design px (e.g. 0.67 when --ui-scale is 0.67).
export function uiScale() {

  if (typeof window === 'undefined') return 1

  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)

  return rootPx > 0 ? rootPx / 16 : 1
}

// Measured element width (screen px) -> design px, for fitSeatSize().
export const toDesignPx = (screenPx) => screenPx / uiScale()

// CSS custom properties consumed by the .asw seat grid styles.
export function gridVars(seat) {

  const m = seatMetrics(seat)

  return {
    '--seat': rem(m.seat),
    '--aisle': rem(m.aisle),
    '--label': rem(m.label),
    '--seat-font': rem(m.font),
    '--seat-gap': rem(SEAT_GAP),
  }
}

// One grid track for the row label, one per seat, one extra per vertical aisle.
// Every track must be filled by a real child element (seat, placeholder or
// spacer), otherwise seats slide into the aisle track and overlap.
export function buildGridTemplate(cols, vGaps) {

  const gaps = new Set(vGaps)

  const parts = ['var(--label, 2.25rem)']

  for (let c = 0; c < cols; c++) {

    parts.push('var(--seat, 2.125rem)')

    if (gaps.has(c)) parts.push('var(--aisle, 1.6875rem)')
  }

  return parts.join(' ')
}

// Keep only valid aisle positions: an aisle goes AFTER a 0-based column/row
// and never after the last one.
export function cleanGaps(list, count) {

  if (!Array.isArray(list)) return []

  const out = new Set()

  for (const g of list) {

    if (Number.isInteger(g) && g >= 0 && g <= count - 2) out.add(g)
  }

  return [...out].sort((a, b) => a - b)
}

// Largest seat size (px) that makes the whole row fit in `availWidth`.
export function fitSeatSize(availWidth, cols, aisleCount) {

  for (let s = DEFAULT_SEAT + 2; s >= MIN_SEAT; s--) {

    const m = seatMetrics(s)

    const width =
      m.label + SEAT_GAP +
      cols * (s + SEAT_GAP) +
      aisleCount * (m.aisle + SEAT_GAP)

    if (width <= availWidth) return s
  }

  return MIN_SEAT
}

export function formatINR(value) {

  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}