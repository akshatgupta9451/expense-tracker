import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterForm from '@/components/auth/RegisterForm'
import { AuthContext } from '@/context/AuthContext'

function setup(register = vi.fn()) {
  render(
    <AuthContext.Provider value={{ register }}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const input = (label) => screen.getByLabelText(label, { selector: 'input' })
  const type = (label, value) => fireEvent.change(input(label), { target: { value } })
  const fillValid = () => {
    type('Email', 'ada@example.com')
    type('Password', 'Passw0rd123')
    type('Confirm password', 'Passw0rd123')
  }
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  return { register, input, type, fillValid, submit }
}

test('no error banner before anything goes wrong', () => {
  setup()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('validates a field when it loses focus, and clears the error once fixed', () => {
  const { input, type } = setup()
  type('Email', 'nope')
  expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument()
  fireEvent.blur(input('Email'))
  expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  type('Email', 'nope@example.com')
  expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument()
})

test('tabbing past an empty field does not show an error', () => {
  const { input } = setup()
  fireEvent.blur(input('Email'))
  expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
})

test('live strength meter and checklist', () => {
  const { type } = setup()
  type('Password', 'abc')
  expect(screen.getByText('Too weak')).toBeInTheDocument()
  expect(screen.getByText('At least 8 characters').parentElement).toHaveTextContent('(missing)')
  type('Password', 'abcdefg1')
  expect(screen.getByText('Fair')).toBeInTheDocument()
  expect(screen.getByText('At least 8 characters').parentElement).toHaveTextContent('(done)')
  expect(screen.getByText('A letter and a number').parentElement).toHaveTextContent('(done)')
})

test('confirm password must match, and updates when the password changes', () => {
  const { type, submit } = setup()
  type('Email', 'ada@example.com')
  type('Password', 'Passw0rd123')
  type('Confirm password', 'Passw0rd12')
  submit()
  expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  type('Password', 'Passw0rd12')
  expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
})

test('submits trimmed values and goes to the dashboard', async () => {
  const { register, type, fillValid, submit } = setup(vi.fn().mockResolvedValue({}))
  type('Name', '  Ada  ')
  fillValid()
  submit()
  await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument())
  expect(register).toHaveBeenCalledWith({
    name: 'Ada',
    email: 'ada@example.com',
    password: 'Passw0rd123',
  })
})

test('taken email is shown on the email field with a link to log in', async () => {
  const register = vi.fn().mockRejectedValue({
    response: {
      status: 409,
      data: { error: { code: 'conflict', message: 'exists', details: {} } },
    },
  })
  const { input, fillValid, submit, type } = setup(register)
  fillValid()
  submit()
  expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument()
  expect(input('Email')).toHaveFocus()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument() // field error, not a banner
  expect(screen.getByRole('link', { name: 'Log in instead →' })).toBeInTheDocument()
  // Editing the email clears the server error.
  type('Email', 'ada2@example.com')
  expect(screen.queryByText('An account with this email already exists')).not.toBeInTheDocument()
})

test('server validation errors land on their fields', async () => {
  const register = vi.fn().mockRejectedValue({
    response: {
      status: 422,
      data: { error: { details: [{ field: 'password', message: 'Password too common' }] } },
    },
  })
  const { input, fillValid, submit } = setup(register)
  fillValid()
  submit()
  expect(await screen.findByText('Password too common')).toBeInTheDocument()
  expect(input('Password')).toHaveFocus()
})
