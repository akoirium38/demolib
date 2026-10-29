import { api } from './client'

export const createBook = (payload) => api.post('/books', payload).then((r) => r.data.data)
