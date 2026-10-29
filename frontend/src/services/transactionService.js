import api from './apiClient'

/** Drop empty filter values so they aren't sent as `?type=`. */
const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))

export const transactionService = {
  list: (filters = {}) => api.get('/transactions', { params: clean(filters) }).then((r) => r.data),
  get: (id) => api.get(`/transactions/${id}`).then((r) => r.data),
  create: (payload) => api.post('/transactions', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/transactions/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/transactions/${id}`),
  /** Returns the number actually deleted (ids of other users are ignored by the API). */
  bulkDelete: (ids) => api.post('/transactions/bulk-delete', { ids }).then((r) => r.data.deleted),
}
