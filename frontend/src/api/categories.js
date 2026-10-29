import { api } from './client'

export const fetchCategories = () => api.get('/categories').then((r) => r.data.data)

export const createCategory = (payload) => api.post('/categories', payload).then((r) => r.data.data)

export const updateCategory = (id, payload) => api.put(`/categories/${id}`, payload).then((r) => r.data.data)

export const deleteCategory = (id) => api.delete(`/categories/${id}`)
