import axios from 'axios'
import { tokenStore } from './tokenStore'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL,
  withCredentials: true, // send the refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
  // FastAPI expects repeated keys for arrays: ?category_id=a&category_id=b
  paramsSerializer: { indexes: null },
})

// Bare client for /auth/refresh so it never goes through the 401 interceptor below.
export const refreshClient = axios.create({ baseURL, withCredentials: true })

let refreshPromise = null
let onSessionExpired = () => {}

/** Called by AuthContext so the API layer can log the user out without importing React. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

/**
 * Exchange the refresh cookie for a new access token. Concurrent callers share one request,
 * so a burst of 401s triggers a single refresh (the backend rotates tokens on every refresh).
 */
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then(({ data }) => {
        tokenStore.set(data.access_token)
        return data.access_token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const skip = !original || original._retry || NO_RETRY.some((p) => original.url?.endsWith(p))

    if (status !== 401 || skip) return Promise.reject(error)

    original._retry = true
    try {
      const token = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch (refreshError) {
      tokenStore.clear()
      onSessionExpired()
      return Promise.reject(refreshError)
    }
  },
)

export default api
