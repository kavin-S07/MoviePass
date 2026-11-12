import { apiFetch } from './api'

// Error codes returned by the FastAPI OAuth callback redirect,
// mapped to messages we can show to the user.
export const OAUTH_ERRORS = {
  oauth_not_configured: 'Social sign-in is not configured yet.',
  provider_cancelled: 'Sign-in was cancelled.',
  invalid_state: 'Your sign-in session expired. Please try again.',
  missing_code_or_state: 'Social sign-in failed. Please try again.',
  provider_auth_failed: 'Could not reach the social provider. Please try again.',
  email_missing: 'The provider did not return an email address.',
  email_not_verified: 'Please verify an email address on your social account.',
  account_not_found: 'This social account is no longer linked to a user.',
  unsupported_provider: 'This social provider is not supported.',
}

export const signupBooker = (values) =>
  apiFetch('/auth/signup', { method: 'POST', body: values })

export const signupOwner = (values) =>
  apiFetch('/auth/signup/owner', { method: 'POST', body: values })

export const login = (values) =>
  apiFetch('/auth/login', { method: 'POST', body: values })

export const logout = () =>
  apiFetch('/auth/logout', { method: 'POST', retry: false })

export const fetchHome = (token) =>
  apiFetch('/auth/home', { token })

export const fetchPendingOwners = (token) =>
  apiFetch('/auth/admin/pending-owners', { token })

export const approveOwner = (ownerId, token) =>
  apiFetch(`/auth/admin/approve/${ownerId}`, { method: 'POST', token })

export const rejectOwner = (ownerId, token) =>
  apiFetch(`/auth/admin/reject/${ownerId}`, { method: 'POST', token })
