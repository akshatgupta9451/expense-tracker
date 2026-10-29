// Client-side checks mirror the backend rules so users get instant feedback.
// The server still validates everything.

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export function validateEmail(value) {
  if (!value.trim()) return 'Email is required'
  if (!isEmail(value)) return 'Enter a valid email address'
  return null
}

/** Rules the backend enforces (shown as a live checklist on the register form). */
export const passwordRules = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'A letter and a number', test: (p) => /[A-Za-z]/.test(p) && /\d/.test(p) },
]

/** 0–4 strength score: required rules first, then length and character variety. */
export function passwordScore(password) {
  if (!password) return 0
  if (!passwordRules.every((r) => r.test(password))) return password.length >= 4 ? 1 : 0
  let score = 2
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  return score
}

export function validatePassword(password) {
  if (!password) return 'Password is required'
  if (password.length > 128) return 'Password must be at most 128 characters'
  const failed = passwordRules.find((r) => !r.test(password))
  if (!failed) return null
  return failed === passwordRules[0]
    ? 'Password must be at least 8 characters'
    : 'Password must contain at least one letter and one number'
}

export function validateAmount(value) {
  if (value === '' || value == null) return 'Amount is required'
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) return 'Use a positive number with up to 2 decimals'
  if (Number(value) <= 0) return 'Amount must be greater than 0'
  return null
}
