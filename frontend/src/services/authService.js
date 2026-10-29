import api, { refreshAccessToken } from './apiClient'
import { tokenStore } from './tokenStore'

export const authService = {
  async register({ name, email, password }) {
    const { data } = await api.post('/auth/register', { name: name || null, email, password })
    return data
  },

  async login({ email, password }) {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.access_token)
    return data
  },

  /** Restore a session from the refresh cookie (e.g. after a page reload). */
  async restoreSession() {
    await refreshAccessToken()
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      tokenStore.clear()
    }
  },
}
