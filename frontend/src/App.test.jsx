import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api/books', () => ({
  fetchBooks: vi.fn(() => Promise.resolve({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })),
  createBook: vi.fn(),
}))
vi.mock('./api/categories', () => ({ fetchCategories: vi.fn(() => Promise.resolve([])) }))

describe('App', () => {
  it('hiển thị trang chủ', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Thư viện DemoLib' })).toBeInTheDocument()
    expect(await screen.findByText('Không tìm thấy sách')).toBeInTheDocument()
  })
})
