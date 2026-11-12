import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'

import logo from '../assets/logo.jpeg'

const DEFAULT_CATEGORIES = [
  { category_name: 'Regular', price: 150, color: '#3b82f6' },
  { category_name: 'Premium', price: 250, color: '#a855f7' },
  { category_name: 'VIP',     price: 400, color: '#f59e0b' },
]

const COLOR_CHOICES = [
  '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#22c55e', '#06b6d4', '#ec4899', '#64748b',
]

// Step 1: Screen details + categories.
// On save, builds the layout grid and hands off to Step 2 via onNext().
export default function ScreenInfoForm({ onNext, onCancel }) {

  const { token } = useAuth()

  const [name, setName] = useState('Screen 1')

  const [number, setNumber] = useState('')

  const [rows, setRows] = useState(10)

  const [cols, setCols] = useState(12)

  const [hasCategories, setHasCategories] = useState(true)

  const [defaultPrice, setDefaultPrice] = useState(150)

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)

  const [error, setError] = useState('')

  const totalSeats = rows * cols

  function addCategory() {

    setCategories((prev) => [
      ...prev,
      { category_name: `Category ${prev.length + 1}`, price: 100, color: '#64748b' },
    ])
  }

  function updateCategory(index, patch) {

    setCategories((prev) =>
      prev.map((cat, i) => (i === index ? { ...cat, ...patch } : cat))
    )
  }

  function removeCategory(index) {

    if (categories.length <= 1) {

      setError('Keep at least one category.')

      return
    }

    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  function validate() {

    const nameTrim = name.trim()

    if (!nameTrim) return 'Screen name is required'

    if (rows < 1 || rows > 52) return 'Rows must be between 1 and 52'

    if (cols < 1 || cols > 40) return 'Columns must be between 1 and 40'

    if (!hasCategories && (!defaultPrice || defaultPrice <= 0)) {

      return 'Set a default ticket price'
    }

    if (hasCategories) {

      const names = new Set(categories.map((c) => c.category_name.trim().toLowerCase()))

      if (names.size !== categories.length) return 'Category names must be unique'

      for (const cat of categories) {

        if (!cat.category_name.trim()) return 'Every category needs a name'

        if (!cat.price || cat.price < 0) return 'Every category needs a valid price'
      }
    }

    return ''
  }

  function handleSave(e) {

    e.preventDefault()

    setError('')

    const validation = validate()

    if (validation) {

      setError(validation)

      return
    }

    onNext({
      screen_name: name.trim(),
      screen_number: number === '' ? null : Number(number),
      no_of_rows: rows,
      no_of_columns: cols,
      has_categories: hasCategories,
      default_price: hasCategories ? null : Number(defaultPrice),
      categories: hasCategories ? categories : [
        { category_name: 'Standard', price: Number(defaultPrice), color: '#3b82f6' },
      ],
      seats: {
        rows,
        cols,
      },
    })
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>Add Screen</h1>
          <p>Step 1 of 3: enter screen information.</p>
        </div>
      </header>

      <form className="panel form-grid" onSubmit={handleSave}>
        <label className="form-field">
          <span>Screen Name *</span>
          <input
            name="screen_name"
            placeholder="Screen 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Screen Number</span>
          <input
            name="screen_number"
            type="number"
            min="1"
            placeholder="1"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Number of Rows *</span>
          <input
            type="number"
            min="1"
            max="52"
            value={rows}
            onChange={(e) => setRows(Number(e.target.value) || 0)}
          />
        </label>

        <label className="form-field">
          <span>Number of Columns *</span>
          <input
            type="number"
            min="1"
            max="40"
            value={cols}
            onChange={(e) => setCols(Number(e.target.value) || 0)}
          />
        </label>

        <div className="form-field stat-card">
          <span>Total Seats</span>
          <strong className="stat-strong">{totalSeats || 0}</strong>
        </div>

        <label className="form-field form-field-full">
          <span>Different seat categories?</span>
          <div className="radio-row">
            <label className="radio-choice">
              <input
                type="radio"
                name="has_categories"
                checked={hasCategories}
                onChange={() => setHasCategories(true)}
              />
              <span>Yes, I want different categories</span>
            </label>
            <label className="radio-choice">
              <input
                type="radio"
                name="has_categories"
                checked={!hasCategories}
                onChange={() => setHasCategories(false)}
              />
              <span>No, single category for all seats</span>
            </label>
          </div>
        </label>

        {!hasCategories && (
          <label className="form-field">
            <span>Default Ticket Price (₹)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(Number(e.target.value) || 0)}
            />
          </label>
        )}

        {hasCategories && (
          <div className="category-editor form-field-full">
            <div className="panel-head">
              <h2>Seat Categories</h2>
              <button type="button" className="btn-secondary btn-inline" onClick={addCategory}>
                + Add Category
              </button>
            </div>

            <div className="category-table">
              <div className="category-row category-head">
                <span>Name</span>
                <span>Price</span>
                <span>Color</span>
                <span></span>
              </div>

              {categories.map((cat, index) => (
                <div className="category-row" key={index}>
                  <input
                    aria-label="Category name"
                    value={cat.category_name}
                    onChange={(e) => updateCategory(index, { category_name: e.target.value })}
                  />

                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label="Category price"
                    value={cat.price}
                    onChange={(e) => updateCategory(index, { price: Number(e.target.value) || 0 })}
                  />

                  <div className="color-swatches">
                    {COLOR_CHOICES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Color ${c}`}
                        className={`swatch ${cat.color === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => updateCategory(index, { color: c })}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Remove category"
                    onClick={() => removeCategory(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <p className="muted">Seat assignment will happen in the next step.</p>
          </div>
        )}

        {error && <p className="error form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save and Continue →
          </button>
        </div>
      </form>
    </div>
  )
}
