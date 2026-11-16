import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'

import { fetchTheatre } from '../services/theatres'

import ScreenInfoForm from './ScreenInfoForm'
import SeatDesigner from './SeatDesigner'
import ScreenPreview from './ScreenPreview'

import './AddScreen.css'

const STEPS = [
  { id: 'form', title: 'Screen Info', hint: 'Name, size & pricing' },
  { id: 'layout', title: 'Seat Layout', hint: 'Design the seat map' },
  { id: 'preview', title: 'Preview & Save', hint: 'Review and confirm' },
]

// Add Screen flow container: Step 1 form -> Step 2 layout -> Step 3 preview/save
export default function AddScreenPage({ theatreId, onDone }) {

  const { token } = useAuth()

  const [step, setStep] = useState('form')

  // Step 1 result (kept so Back never loses what was typed)
  const [screen, setScreen] = useState(null)

  // Step 2 result / draft (kept so Back never loses the seat layout)
  const [payload, setPayload] = useState(null)

  const [theatreName, setTheatreName] = useState('')

  const [theatreError, setTheatreError] = useState(false)

  useEffect(() => {

    if (!theatreId) return undefined

    let cancelled = false

    fetchTheatre(theatreId, token)
      .then((theatre) => {

        if (cancelled) return

        setTheatreName(theatre.name || '')

        setTheatreError(false)
      })
      .catch(() => {

        if (cancelled) return

        setTheatreName('')

        setTheatreError(true)
      })

    return () => {
      cancelled = true
    }
  }, [theatreId, token])

  // Warn before a refresh / tab close once there is real work in progress
  const inProgress = step !== 'form'

  useEffect(() => {

    if (!inProgress) return undefined

    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', warn)

    return () => window.removeEventListener('beforeunload', warn)
  }, [inProgress])

  // theatre_name is merged in at render time, so it is correct even if the
  // theatre request finished after the user left Step 1.
  const designerScreen = useMemo(
    () => (screen ? { ...screen, theatre_name: theatreName } : null),
    [screen, theatreName]
  )

  function cancelFlow() {

    if ((screen || payload) &&
      !window.confirm('Discard this new screen? Your changes will be lost.')) {

      return
    }

    onDone()
  }

  if (!theatreId) {

    return (
      <div className="asw">
        <div className="panel asw-empty" role="alert">
          <h2>No theatre selected</h2>
          <p className="muted">Open a theatre first, then choose “Add Screen”.</p>
          <button type="button" className="btn-secondary" onClick={() => onDone()}>
            Back
          </button>
        </div>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  let content = null

  if (step === 'form') {

    content = (
      <ScreenInfoForm
        initialValues={screen}
        onCancel={cancelFlow}
        onNext={(data) => {

          setScreen(data)

          setStep('layout')
        }}
      />
    )
  }

  if (step === 'layout' && designerScreen) {

    content = (
      <SeatDesigner
        initialScreen={designerScreen}
        initialLayout={payload}
        onBack={(draft) => {

          // The designer hands back its current work so it can be restored
          if (draft) setPayload(draft)

          setStep('form')
        }}
        onSave={(nextPayload) => {

          setPayload(nextPayload)

          setStep('preview')
        }}
      />
    )
  }

  if (step === 'preview' && payload) {

    content = (
      <ScreenPreview
        theatreId={theatreId}
        payload={payload}
        onBack={() => setStep('layout')}
        onDone={onDone}
      />
    )
  }

  return (
    <div className="asw">
      <div className="asw-top">
        <div>
          <h1>Add Screen</h1>
          <p className="muted">
            {theatreName
              ? `Adding a screen to ${theatreName}`
              : `Adding a screen to theatre #${theatreId}`}
            {theatreError && ' (theatre name could not be loaded)'}
          </p>
        </div>

        {step !== 'form' && (
          <button type="button" className="btn-secondary" onClick={cancelFlow}>
            Cancel
          </button>
        )}
      </div>

      <ol className="asw-stepper" aria-label="Add screen progress">
        {STEPS.map((s, i) => {

          const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo'

          return (
            <li
              key={s.id}
              className={`asw-step is-${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="asw-step-dot" aria-hidden="true">
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="asw-step-text">
                <strong>{s.title}</strong>
                <small>{s.hint}</small>
              </span>
              <span className="asw-sr">
                {state === 'done' ? ' (completed)' : state === 'current' ? ' (current step)' : ''}
              </span>
            </li>
          )
        })}
      </ol>

      {content}
    </div>
  )
}