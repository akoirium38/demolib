import { api } from './client'

export const fetchProfile = () => api.get('/me/profile').then((r) => r.data.data)

export const updateProfile = (payload) => api.put('/me/profile', payload).then((r) => r.data.data)

export const changePassword = (payload) => api.put('/me/password', payload).then((r) => r.data.data)
