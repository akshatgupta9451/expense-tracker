import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginForm from '@/components/auth/LoginForm'
import { AuthContext } from '@/context/AuthContext'

function setup(login) {
  render(
    <AuthContext.Provider value={{ login }}>
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: { pathname: '/transactions' } } }]}
      >
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/transactions" element={<p>transactions page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const type = (label, value) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  return { type, submit }
}

test('validates before calling the API', async () => {
  const login = vi.fn()
  const { type, submit } = setup(login)
  type('Email', 'not-an-email')
  submit()
  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(screen.getByText('Password is required')).toBeInTheDocument()
  expect(login).not.toHaveBeenCalled()
  // Focus moves to the first invalid field.
  expect(screen.getByLabelText('Email')).toHaveFocus()
})

test('locks the form and shows progress while logging in', async () => {
  let finish
  const login = vi.fn(() => new Promise((resolve) => (finish = resolve)))
  const { type, submit } = setup(login)
  type('Email', 'a@example.com')
  type('Password', 'secret123')
  submit()
  const button = await screen.findByRole('button', { name: 'Logging in…' })
  expect(button).toBeDisabled()
  expect(screen.getByLabelText('Email')).toBeDisabled()
  finish({})
  await waitFor(() => expect(screen.getByText('transactions page')).toBeInTheDocument())
})

test('show/hide password toggle', () => {
  setup(vi.fn())
  const input = screen.getByLabelText('Password', { selector: 'input' })
  expect(input).toHaveAttribute('type', 'password')
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(input).toHaveAttribute('type', 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
  expect(input).toHaveAttribute('type', 'password')
})

test('network failure gets a clear message', async () => {
  const login = vi.fn().mockRejectedValue(new Error('Network Error'))
  const { type, submit } = setup(login)
  type('Email', 'a@example.com')
  type('Password', 'secret123')
  submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
})

test('shows the server error message', async () => {
  const login = vi.fn().mockRejectedValue({
    response: { status: 401, data: { error: { message: 'Invalid email or password' } } },
  })
  const { type, submit } = setup(login)
  type('Email', 'a@example.com')
  type('Password', 'wrong123')
  submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
})

test('returns to the page the user originally wanted', async () => {
  const login = vi.fn().mockResolvedValue({})
  const { type, submit } = setup(login)
  type('Email', 'a@example.com')
  type('Password', 'secret123')
  submit()
  await waitFor(() => expect(screen.getByText('transactions page')).toBeInTheDocument())
  expect(login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'secret123' })
})
