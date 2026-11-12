import { useState } from 'react'

import { AuthProvider, useAuth } from './context/AuthContext'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import NoticePage from './pages/NoticePage'

import './App.css'

function Shell() {

  const { user, ready } = useAuth()

  const [page, setPage] = useState('login')

  // Wait until authentication restoration finishes
  if (!ready) {

    return (
      <div className="loading-screen">
        Checking your session...
      </div>
    )
  }

  if (user) {

    if (user.role === 'TICKET_BOOKER') {

      return <HomePage />
    }

    // Owner Portal is a separate application - 5174.
    return (
      <NoticePage
        title="Ticket Booking App"
        message="Admin and Theatre Owner accounts must use the Owner Portal at http://localhost:5174"
      />
    )
  }

  if (page === 'signup') {

    return <SignupPage onSwitch={() => setPage('login')} />
  }

  return <LoginPage onSwitch={() => setPage('signup')} />
}

function App() {

  return (
    <AuthProvider kind="booker">
      <Shell />
    </AuthProvider>
  )
}

export default App
