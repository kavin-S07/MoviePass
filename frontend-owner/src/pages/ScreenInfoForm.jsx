import { useMemo, useRef, useState } from 'react'

const DEFAULT_CATEGORIES = [
  { category_name: 'Regular', price: 150, color: '#3b82f6' },
  { category_name: 'Premium', price: 250, color: '#a855f7' },
  { category_name: 'VIP',     price: 400, color: '#f59e0b' },
]

const COLOR_CHOICES = [
  '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#22c55e', '#06b6d4', '#ec4899', '#64748b',
]

const SIZE_PRESETS = [
  { label: 'Small', rows: 8, cols: 10 },
  { label: 'Medium', rows: 10, cols: 12 },
  { label: 'Large', rows: 14, cols: 18 },
]

const MAX_ROWS = 52
const MAX_COLS = 40

// '' / '1.5' / 'abc' -> NaN, '12' -> 12
function wholeNumber(value) {

  if (value === '' || value === null || value === undefined) return NaN

  const n = Number(value)

  return Number.isInteger(n) ? n : NaN
}

function inputProps(id, error, help) {

  return {
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-err` : help ? `${id}-help` : undefined,
  }
}

function Field({ id, label, required, help, error, children }) {

  return (
    <div className="asw-field">
      <label className="asw-label" htmlFor={id}>
        {label}
        {required && <span className="asw-req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error
        ? <p className="asw-err" id={`${id}-err`}>{error}</p>
        : help
          ? <p className="asw-help" id={`${id}-help`}>{help}</p>
          : null}
    </div>
  )
}

// Small SVG preview of the grid being configured
function LayoutThumb({ rows, cols }) {

  const ok = rows >= 1 && rows <= MAX_ROWS && cols >= 1 && cols <= MAX_COLS

  if (!ok) {

    return <div className="asw-thumb asw-thumb-empty">Enter rows and columns to see a preview</div>
  }

  const cell = 10

  const w = cols * cell

  const h = rows * cell

  return (
    <div className="asw-thumb">
      <svg
        viewBox={`0 0 ${w} ${h + 16}`}
        role="img"
        aria-label={`Seat grid preview, ${rows} rows by ${cols} columns`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="asw-thumb-seat" width={cell} height={cell} patternUnits="userSpaceOnUse">
            <rect x="1.4" y="1.4" width="7.2" height="7.2" rx="1.8" fill="#3b82f6" />
          </pattern>
        </defs>
        <rect x={w * 0.1} y="2" width={w * 0.8} height="4" rx="2" fill="#222" />
        <rect x="0" y="14" width={w} height={h} fill="url(#asw-thumb-seat)" />
      </svg>
    </div>
  )
}

// Step 1: Screen details + categories.
// On submit, hands the data to Step 2 via onNext() (same shape as before).
// `initialValues` is optional: it is the object previously passed to onNext,
// used to restore the form when the user comes back from a later step.
export default function ScreenInfoForm({ onNext, onCancel, initialValues = null }) {

  const init = initialValues || {}

  const idRef = useRef(0)

  const nextId = () => {

    idRef.current += 1

    return idRef.current
  }

  const [name, setName] = useState(init.screen_name ?? 'Screen 1')

  const [number, setNumber] = useState(init.screen_number != null ? String(init.screen_number) : '')

  const [rows, setRows] = useState(String(init.no_of_rows ?? 10))

  const [cols, setCols] = useState(String(init.no_of_columns ?? 12))

  const [hasCategories, setHasCategories] = useState(init.has_categories ?? true)

  const [defaultPrice, setDefaultPrice] = useState(String(init.default_price ?? 150))

  const [categories, setCategories] = useState(() => {

    const source = init.has_categories && init.categories?.length
      ? init.categories
      : DEFAULT_CATEGORIES

    return source.map((c) => ({
      id: nextId(),
      category_name: c.category_name,
      price: String(c.price),
      color: c.color,
    }))
  })

  const [touched, setTouched] = useState({})

  const [submitted, setSubmitted] = useState(false)

  const formRef = useRef(null)

  const rowsNum = wholeNumber(rows)

  const colsNum = wholeNumber(cols)

  const totalSeats = rowsNum >= 1 && colsNum >= 1 ? rowsNum * colsNum : null

  const touch = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))

  // ---- validation (same rules as before, plus whole-number checks) ----

  const errors = useMemo(() => {

    const e = { cats: {} }

    if (!name.trim()) e.name = 'Screen name is required.'

    if (number !== '') {

      const n = wholeNumber(number)

      if (!(n >= 1)) e.number = 'Use a whole number of 1 or more, or leave it blank.'
    }

    const r = wholeNumber(rows)

    if (!(r >= 1 && r <= MAX_ROWS)) e.rows = `Enter a whole number from 1 to ${MAX_ROWS}.`

    const c = wholeNumber(cols)

    if (!(c >= 1 && c <= MAX_COLS)) e.cols = `Enter a whole number from 1 to ${MAX_COLS}.`

    if (!hasCategories) {

      const p = wholeNumber(defaultPrice)

      if (!(p > 0)) e.defaultPrice = 'Enter a ticket price greater than 0.'

    } else {

      const seen = new Set()

      categories.forEach((cat, i) => {

        const ce = {}

        const key = cat.category_name.trim().toLowerCase()

        if (!key) ce.name = 'Give this category a name.'

        else if (seen.has(key)) ce.name = 'Category names must be unique.'

        seen.add(key)

        const p = wholeNumber(cat.price)

        if (!(p > 0)) ce.price = 'Price must be above 0.'

        if (ce.name || ce.price) e.cats[i] = ce
      })
    }

    return e

  }, [name, number, rows, cols, hasCategories, defaultPrice, categories])

  const errorCount =
    ['name', 'number', 'rows', 'cols', 'defaultPrice'].filter((k) => errors[k]).length +
    Object.keys(errors.cats).length

  const show = (key) => (submitted || touched[key] ? errors[key] : undefined)

  const showCat = (cat, i, field) =>
    (submitted || touched[`cat-${cat.id}-${field}`]) ? errors.cats[i]?.[field] : undefined

  // ---- category editing ----

  function addCategory() {

    setCategories((prev) => {

      const used = new Set(prev.map((c) => c.color))

      const color = COLOR_CHOICES.find((c) => !used.has(c)) || '#64748b'

      let n = prev.length + 1

      const names = new Set(prev.map((c) => c.category_name.trim().toLowerCase()))

      while (names.has(`category ${n}`)) n += 1

      return [...prev, { id: nextId(), category_name: `Category ${n}`, price: '100', color }]
    })
  }

  function updateCategory(index, patch) {

    setCategories((prev) => prev.map((cat, i) => (i === index ? { ...cat, ...patch } : cat)))
  }

  function removeCategory(index) {

    setCategories((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function applyPreset(preset) {

    setRows(String(preset.rows))

    setCols(String(preset.cols))
  }

  // ---- submit ----

  function handleSubmit(e) {

    e.preventDefault()

    setSubmitted(true)

    if (errorCount > 0) {

      requestAnimationFrame(() => {

        formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
      })

      return
    }

    const r = wholeNumber(rows)

    const c = wholeNumber(cols)

    const p = wholeNumber(defaultPrice)

    onNext({
      screen_name: name.trim(),
      screen_number: number === '' ? null : Number(number),
      no_of_rows: r,
      no_of_columns: c,
      has_categories: hasCategories,
      default_price: hasCategories ? null : p,
      categories: hasCategories
        ? categories.map((cat) => ({
          category_name: cat.category_name.trim(),
          price: Number(cat.price),
          color: cat.color,
        }))
        : [{ category_name: 'Standard', price: p, color: '#3b82f6' }],
      seats: {
        rows: r,
        cols: c,
      },
    })
  }

  return (
    <form className="asw-form" noValidate onSubmit={handleSubmit} ref={formRef}>
      <header className="dash-header asw-stepheader">
        <div>
          <h1>Screen Information</h1>
          <p>Name the screen, choose its size, then set up seat categories and prices.</p>
        </div>
        <span className="muted">Fields marked * are required</span>
      </header>

      {submitted && errorCount > 0 && (
        <div className="asw-banner asw-banner-err" role="alert">
          Please fix the {errorCount} highlighted {errorCount === 1 ? 'field' : 'fields'} to continue.
        </div>
      )}

      <div className="asw-form-layout">
        <div className="asw-form-main">

          {/* ---- Screen details ---- */}
          <section className="panel asw-section" aria-labelledby="asw-sec-details">
            <h2 id="asw-sec-details">Screen details</h2>
            <p className="asw-section-sub">How this screen appears to customers and how big the seat grid is.</p>

            <div className="asw-fields">
              <Field
                id="asw-name"
                label="Screen name"
                required
                help="Shown to customers, e.g. “Screen 1” or “IMAX Hall”."
                error={show('name')}
              >
                <input
                  {...inputProps('asw-name', show('name'), true)}
                  className="asw-input"
                  name="screen_name"
                  placeholder="Screen 1"
                  autoComplete="off"
                  aria-required="true"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => touch('name')}
                />
              </Field>

              <Field
                id="asw-number"
                label="Screen number"
                help="Optional. Useful if your theatre numbers its halls."
                error={show('number')}
              >
                <input
                  {...inputProps('asw-number', show('number'), true)}
                  className="asw-input"
                  name="screen_number"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  placeholder="1"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  onBlur={() => touch('number')}
                />
              </Field>

              <Field
                id="asw-rows"
                label="Rows"
                required
                help={`1 to ${MAX_ROWS}. Rows are lettered A, B, C…`}
                error={show('rows')}
              >
                <input
                  {...inputProps('asw-rows', show('rows'), true)}
                  className="asw-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={MAX_ROWS}
                  aria-required="true"
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  onBlur={() => touch('rows')}
                />
              </Field>

              <Field
                id="asw-cols"
                label="Columns (seats per row)"
                required
                help={`1 to ${MAX_COLS}. Seats are numbered 1, 2, 3…`}
                error={show('cols')}
              >
                <input
                  {...inputProps('asw-cols', show('cols'), true)}
                  className="asw-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={MAX_COLS}
                  aria-required="true"
                  value={cols}
                  onChange={(e) => setCols(e.target.value)}
                  onBlur={() => touch('cols')}
                />
              </Field>
            </div>

            <div className="asw-presets" role="group" aria-label="Quick size presets">
              <span className="muted">Quick size:</span>
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="asw-chipbtn"
                  onClick={() => applyPreset(p)}
                >
                  {p.label} · {p.rows}×{p.cols}
                </button>
              ))}
            </div>
          </section>

          {/* ---- Pricing & categories ---- */}
          <section className="panel asw-section" aria-labelledby="asw-sec-pricing">
            <h2 id="asw-sec-pricing">Pricing &amp; categories</h2>
            <p className="asw-section-sub">
              Categories let you charge different prices (Regular, Premium, VIP…). You assign them to seats in the next step.
            </p>

            <fieldset className="asw-choices">
              <legend className="asw-label">How should seats be priced?</legend>

              <label className="asw-choice">
                <input
                  type="radio"
                  name="has_categories"
                  checked={hasCategories}
                  onChange={() => setHasCategories(true)}
                />
                <span>
                  <strong>Multiple categories</strong>
                  <small>Different prices for different seats</small>
                </span>
              </label>

              <label className="asw-choice">
                <input
                  type="radio"
                  name="has_categories"
                  checked={!hasCategories}
                  onChange={() => setHasCategories(false)}
                />
                <span>
                  <strong>One price for all seats</strong>
                  <small>A single “Standard” category</small>
                </span>
              </label>
            </fieldset>

            {!hasCategories && (
              <div className="asw-fields asw-fields-narrow">
                <Field
                  id="asw-price"
                  label="Ticket price (₹)"
                  required
                  help="Applied to every seat on this screen."
                  error={show('defaultPrice')}
                >
                  <input
                    {...inputProps('asw-price', show('defaultPrice'), true)}
                    className="asw-input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    aria-required="true"
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(e.target.value)}
                    onBlur={() => touch('defaultPrice')}
                  />
                </Field>
              </div>
            )}

            {hasCategories && (
              <div className="asw-cats">
                <div className="asw-cats-head">
                  <h3>Seat categories</h3>
                  <button type="button" className="btn-secondary asw-btn-sm" onClick={addCategory}>
                    + Add category
                  </button>
                </div>

                <div className="asw-cat-cols muted" aria-hidden="true">
                  <span>Name</span>
                  <span>Price (₹)</span>
                  <span>Colour</span>
                  <span />
                </div>

                <ul className="asw-cat-list">
                  {categories.map((cat, i) => {

                    const nameErr = showCat(cat, i, 'name')

                    const priceErr = showCat(cat, i, 'price')

                    return (
                      <li className="asw-cat-row" key={cat.id}>
                        <div className="asw-cat-cell">
                          <label className="asw-mini-label" htmlFor={`asw-cat-name-${cat.id}`}>
                            Category {i + 1} name
                          </label>
                          <input
                            {...inputProps(`asw-cat-name-${cat.id}`, nameErr, false)}
                            className="asw-input"
                            value={cat.category_name}
                            placeholder="e.g. Premium"
                            autoComplete="off"
                            onChange={(e) => updateCategory(i, { category_name: e.target.value })}
                            onBlur={() => touch(`cat-${cat.id}-name`)}
                          />
                          {nameErr && <p className="asw-err" id={`asw-cat-name-${cat.id}-err`}>{nameErr}</p>}
                        </div>

                        <div className="asw-cat-cell">
                          <label className="asw-mini-label" htmlFor={`asw-cat-price-${cat.id}`}>
                            Category {i + 1} price
                          </label>
                          <div className="asw-prefix">
                            <span aria-hidden="true">₹</span>
                            <input
                              {...inputProps(`asw-cat-price-${cat.id}`, priceErr, false)}
                              className="asw-input"
                              type="number"
                              inputMode="numeric"
                              min="1"
                              step="1"
                              value={cat.price}
                              onChange={(e) => updateCategory(i, { price: e.target.value })}
                              onBlur={() => touch(`cat-${cat.id}-price`)}
                            />
                          </div>
                          {priceErr && <p className="asw-err" id={`asw-cat-price-${cat.id}-err`}>{priceErr}</p>}
                        </div>

                        <div className="asw-cat-cell">
                          <span className="asw-mini-label">Category {i + 1} colour</span>
                          <div className="asw-swatches" role="group" aria-label={`Colour for category ${i + 1}`}>
                            {COLOR_CHOICES.map((color) => (
                              <button
                                key={color}
                                type="button"
                                aria-label={`Colour ${color}`}
                                aria-pressed={cat.color === color}
                                className={`asw-swatch ${cat.color === color ? 'selected' : ''}`}
                                style={{ background: color }}
                                onClick={() => updateCategory(i, { color })}
                              />
                            ))}
                            <input
                              type="color"
                              className="asw-colorpick"
                              aria-label="Custom colour"
                              title="Custom colour"
                              value={cat.color}
                              onChange={(e) => updateCategory(i, { color: e.target.value })}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="asw-iconbtn"
                          aria-label={`Remove category ${cat.category_name || i + 1}`}
                          title={categories.length <= 1 ? 'Keep at least one category' : 'Remove category'}
                          disabled={categories.length <= 1}
                          onClick={() => removeCategory(i)}
                        >
                          ✕
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <p className="asw-help">You will assign these to seats in Step 2. At least one category is required.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---- Live summary ---- */}
        <aside className="panel asw-aside" aria-label="Layout summary">
          <h2>Layout preview</h2>

          <LayoutThumb rows={rowsNum} cols={colsNum} />

          <dl className="asw-facts">
            <div>
              <dt>Grid</dt>
              <dd>{rowsNum >= 1 && colsNum >= 1 ? `${rowsNum} × ${colsNum}` : '—'}</dd>
            </div>
            <div>
              <dt>Total seats</dt>
              <dd>{totalSeats ?? '—'}</dd>
            </div>
            <div>
              <dt>Pricing</dt>
              <dd>{hasCategories ? `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}` : 'Single price'}</dd>
            </div>
          </dl>

          <p className="asw-help">You can remove seats and add aisles in the next step.</p>
        </aside>
      </div>

      <div className="asw-actionbar">
        <p className="muted asw-hint">Step 1 of 3 · Next you will design the seat layout.</p>
        <div className="asw-actionbar-buttons">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save and Continue →
          </button>
        </div>
      </div>
    </form>
  )
}