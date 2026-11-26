import { apiFetch } from './api'

export const fetchNotifications = () =>
  apiFetch('/notifications')

export const fetchUnreadCount = () =>
  apiFetch('/notifications/unread-count')

export const markNotificationRead = (id) =>
  apiFetch(`/notifications/${id}/read`, { method: 'POST' })

export const markAllNotificationsRead = () =>
  apiFetch('/notifications/read-all', { method: 'POST' })
