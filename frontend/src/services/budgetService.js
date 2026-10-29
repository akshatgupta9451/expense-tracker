import api from './apiClient'

export const budgetService = {
  /** Overview for one month ("YYYY-MM"): overall budget, category budgets, pacing. */
  summary: (month) => api.get('/budgets/summary', { params: { month } }).then((r) => r.data),
  /** `category_id` null/omitted = the overall monthly budget. */
  create: ({ month, monthly_limit, alert_threshold, category_id = null }) =>
    api
      .post('/budgets', { month, monthly_limit, alert_threshold, category_id })
      .then((r) => r.data),
  update: (id, changes) => api.patch(`/budgets/${id}`, changes).then((r) => r.data),
  remove: (id) => api.delete(`/budgets/${id}`),
  copy: (fromMonth, toMonth) =>
    api
      .post('/budgets/copy', { from_month: fromMonth, to_month: toMonth })
      .then((r) => r.data.copied),
}
