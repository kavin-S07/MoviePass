import { apiFetch } from './api'

export const fetchNotifications = (token) =>
  apiFetch('/notifications', { token })

export const fetchUnreadCount = (token) =>
  apiFetch('/notifications/unread-count', { token })

export const markNotificationRead = (id, token) =>
  apiFetch(`/notifications/${id}/read`, { method: 'POST', token })

export const markAllNotificationsRead = (token) =>
  apiFetch('/notifications/read-all', { method: 'POST', token })
