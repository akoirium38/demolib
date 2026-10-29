import { api } from './client'

export const registerUser = (payload) => api.post('/auth/register', payload).then((r) => r.data.data)
