import { api } from './client'

// 2.2.3 — trả về { data, meta }
export const fetchBooks = (params) => api.get('/books', { params }).then((r) => r.data)

export const createBook = (payload) => api.post('/books', payload).then((r) => r.data.data)
