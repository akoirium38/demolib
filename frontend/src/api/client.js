import axios from 'axios'

export const TOKEN_KEY = 'demolib_token'

// Dev: Vite proxy /api → backend. Prod: đặt VITE_API_URL.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Lấy thông điệp lỗi theo format { error: { code, message, details } } của backend.
export const getErrorMessage = (err) =>
  err?.response?.data?.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại'

// Đẩy lỗi từ backend vào React Hook Form: details[] → lỗi từng field; trả về true nếu đã gán được.
export const applyServerErrors = (err, setError, fieldByCode = {}) => {
  const error = err?.response?.data?.error
  if (!error) return false
  if (fieldByCode[error.code]) {
    setError(fieldByCode[error.code], { type: 'server', message: error.message })
    return true
  }
  if (error.details?.length) {
    for (const d of error.details) setError(d.field, { type: 'server', message: d.message })
    return true
  }
  return false
}
