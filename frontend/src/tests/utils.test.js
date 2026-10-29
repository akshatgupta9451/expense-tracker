import { getErrorMessage, getFieldErrors } from '@/utils/errors'
import { formatDate, formatPercent } from '@/utils/format'
import { passwordScore, validateAmount, validateEmail, validatePassword } from '@/utils/validators'

test('reads the backend error envelope', () => {
  const err = {
    response: {
      data: {
        error: {
          message: 'Invalid request data',
          details: [{ field: 'amount', message: 'Must be positive' }],
        },
      },
    },
  }
  expect(getErrorMessage(err)).toBe('Invalid request data')
  expect(getFieldErrors(err)).toEqual({ amount: 'Must be positive' })
  expect(getErrorMessage({ message: 'Network Error' })).toMatch(/Cannot reach the server/)
})

test('formats dates without timezone drift', () => {
  expect(formatDate('2026-01-01')).toMatch(/2026/)
  expect(formatDate('2026-01-01')).toMatch(/Jan/)
})

test('formats percentages', () => {
  expect(formatPercent(12.345)).toBe('+12.3%')
  expect(formatPercent(-5)).toBe('-5.0%')
  expect(formatPercent(null)).toBe('—')
})

test('validators mirror backend rules', () => {
  expect(validatePassword('short1')).toMatch(/8 characters/)
  expect(validatePassword('abcdefgh')).toMatch(/letter and one number/)
  expect(validatePassword('')).toBe('Password is required')
  expect(validatePassword('abcdefg1')).toBeNull()
  expect(validateAmount('0')).toMatch(/greater than 0/)
  expect(validateAmount('1.234')).toMatch(/2 decimals/)
  expect(validateAmount('12.50')).toBeNull()
})

test('email validation', () => {
  expect(validateEmail('')).toBe('Email is required')
  expect(validateEmail('a@b')).toMatch(/valid email/)
  expect(validateEmail(' a@b.co ')).toBeNull()
})

test('password strength score', () => {
  expect(passwordScore('')).toBe(0)
  expect(passwordScore('abcdefgh')).toBe(1) // fails a required rule
  expect(passwordScore('abcdefg1')).toBe(2) // meets the rules
  expect(passwordScore('abcdefghijk1')).toBe(3) // + length
  expect(passwordScore('Abcdefghij1!')).toBe(4) // + mixed case and symbol
})
