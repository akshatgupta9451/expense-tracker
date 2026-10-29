export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  TRANSACTION_NEW: '/transactions/new',
  TRANSACTION_EDIT: '/transactions/:id/edit',
  BUDGETS: '/budgets',
  ASSISTANT: '/assistant',
  PROFILE: '/profile',
}

export const transactionEditPath = (id) => `/transactions/${id}/edit`
