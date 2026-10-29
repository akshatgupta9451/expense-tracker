import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/context/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import PublicOnlyRoute from '@/routes/PublicOnlyRoute'

function renderAt(path, status) {
  return render(
    <AuthContext.Provider value={{ status, isAuthenticated: status === 'authenticated' }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<p>dashboard page</p>} />
          </Route>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<p>login page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

test('protected page redirects to login when logged out', () => {
  renderAt('/dashboard', 'unauthenticated')
  expect(screen.getByText('login page')).toBeInTheDocument()
})

test('protected page renders when logged in', () => {
  renderAt('/dashboard', 'authenticated')
  expect(screen.getByText('dashboard page')).toBeInTheDocument()
})

test('shows a spinner while the session is being restored', () => {
  renderAt('/dashboard', 'loading')
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByText('login page')).not.toBeInTheDocument()
})

test('login page sends logged-in users to the dashboard', () => {
  renderAt('/login', 'authenticated')
  expect(screen.getByText('dashboard page')).toBeInTheDocument()
})

test('after login, the guard returns to the originally requested page', () => {
  render(
    <AuthContext.Provider value={{ status: 'authenticated', isAuthenticated: true }}>
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: { pathname: '/transactions' } } }]}
      >
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<p>login page</p>} />
          </Route>
          <Route path="/transactions" element={<p>transactions page</p>} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  expect(screen.getByText('transactions page')).toBeInTheDocument()
})
