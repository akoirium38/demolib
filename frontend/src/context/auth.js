import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

// BR-04: Reader → trang sách, Librarian/Admin → Dashboard
export const homePathFor = (role) => (role === 'READER' ? '/' : '/dashboard')
