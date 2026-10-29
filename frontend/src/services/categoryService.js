import api from './apiClient'

export const categoryService = {
  list: (type) => api.get('/categories', { params: type ? { type } : {} }).then((r) => r.data),
}
