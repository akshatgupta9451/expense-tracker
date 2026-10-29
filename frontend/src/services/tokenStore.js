// The access token lives in memory only (never localStorage), so injected scripts can't
// read it from storage. The refresh token is an HttpOnly cookie the browser handles.
let accessToken = null

export const tokenStore = {
  get: () => accessToken,
  set: (token) => {
    accessToken = token
  },
  clear: () => {
    accessToken = null
  },
}
