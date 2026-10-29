import api from './apiClient'

export const userService = {
  getMe: () => api.get('/users/me').then((r) => r.data),
  updateMe: (changes) => api.patch('/users/me', changes).then((r) => r.data),
  changePassword: (currentPassword, newPassword) =>
    api
      .post('/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .then((r) => r.data),
}
