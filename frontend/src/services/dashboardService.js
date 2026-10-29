import api from './apiClient'

export const dashboardService = {
  /** All-time totals + balance, and totals for `month` ("YYYY-MM", default current). */
  summary: (month) => api.get('/dashboard/summary', { params: { month } }).then((r) => r.data),
  /** Per-month income/expense/net for `months` months ending at `endMonth`. */
  monthly: (months = 6, endMonth) =>
    api.get('/dashboard/monthly', { params: { months, end_month: endMonth } }).then((r) => r.data),
  byCategory: (params = {}) =>
    api.get('/dashboard/category', { params: { limit: 6, ...params } }).then((r) => r.data),
}
