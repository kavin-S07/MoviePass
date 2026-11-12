import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'

import { fetchTheatre } from '../services/theatres'

import ScreenInfoForm from './ScreenInfoForm'
import SeatDesigner from './SeatDesigner'
import ScreenPreview from './ScreenPreview'

// Add Screen flow container: Step 1 form -> Step 2 layout -> Step 3 preview/save
export default function AddScreenPage({ theatreId, onDone }) {

  const { token } = useAuth()

  const [step, setStep] = useState('form')

  const [screen, setScreen] = useState(null)

  const [payload, setPayload] = useState(null)

  const [theatreName, setTheatreName] = useState('')

  useEffect(() => {

    if (!theatreId) return

    fetchTheatre(theatreId, token)
      .then((theatre) => setTheatreName(theatre.name || ''))
      .catch(() => setTheatreName(''))

  }, [theatreId, token])

  if (step === 'form') {

    return (
      <ScreenInfoForm
        onCancel={() => onDone()}
        onNext={(data) => {

          setScreen({
            ...data,
            theatre_name: theatreName,
          })

          setStep('layout')
        }}
      />
    )
  }

  if (step === 'layout') {

    return (
      <SeatDesigner
        initialScreen={screen}
        onBack={() => setStep('form')}
        onSave={(nextPayload) => {

          setPayload(nextPayload)

          setStep('preview')
        }}
      />
    )
  }

  if (step === 'preview') {

    return (
      <ScreenPreview
        theatreId={theatreId}
        payload={payload}
        onBack={() => setStep('layout')}
        onDone={onDone}
      />
    )
  }

  return null
}
