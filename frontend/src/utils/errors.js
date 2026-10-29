/**
 * Helpers for the backend's error envelope:
 *   { "error": { "code": "...", "message": "...", "details": [{ "field", "message" }] } }
 */

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (!error.response) return 'Cannot reach the server. Check your connection.'
  return error.response.data?.error?.message || fallback
}

/** -> { fieldName: "message" } for showing errors next to form inputs. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details
  if (!Array.isArray(details)) return {}
  return Object.fromEntries(details.filter((d) => d.field).map((d) => [d.field, d.message]))
}
