import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { fetchMe } from '../api/auth'
import { fetchCategories } from '../api/categories'
import { createBook } from '../api/books'
import { TOKEN_KEY } from '../api/client'

vi.mock('../api/auth', () => ({ registerUser: vi.fn(), loginUser: vi.fn(), fetchMe: vi.fn() }))
vi.mock('../api/categories', () => ({
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))
vi.mock('../api/books', () => ({ fetchBooks: vi.fn(), createBook: vi.fn() }))

const LIBRARIAN = { id: '1', email: 'lib@demolib.local', name: 'Thủ Thư', role: 'LIBRARIAN' }
const CATEGORIES = [
  { id: 3, name: 'Công nghệ thông tin', bookCount: 3 },
  { id: 5, name: 'Văn học', bookCount: 4 },
]

const renderAddBook = async (categories = CATEGORIES) => {
  localStorage.setItem(TOKEN_KEY, 'jwt-token')
  fetchMe.mockResolvedValue(LIBRARIAN)
  fetchCategories.mockResolvedValue(categories)
  window.history.pushState({}, '', '/books/new')
  render(<App />)
  await screen.findByRole('heading', { name: 'Thêm sách mới' })
}

const fillValid = async (user, overrides = {}) => {
  const v = {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    publishYear: '2008',
    isbn: '978-0-13-235088-4',
    quantity: '5',
    description: 'Sách về code sạch',
    ...overrides,
  }
  for (const [label, value] of [
    ['Tên sách', v.title],
    ['Tác giả', v.author],
    ['Năm xuất bản', v.publishYear],
    ['ISBN (không bắt buộc)', v.isbn],
    ['Số lượng', v.quantity],
    ['Mô tả', v.description],
  ]) {
    const input = screen.getByLabelText(label)
    await user.clear(input)
    if (value) await user.type(input, value)
  }
  await user.selectOptions(screen.getByLabelText('Thể loại'), '3')
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('2.2.2 Thêm sách — AddBookPage', () => {
  it('F-01 EC-01/03/08/10/11: form rỗng → lỗi từng trường, không gọi API', async () => {
    const user = userEvent.setup()
    await renderAddBook()

    await user.click(screen.getByRole('button', { name: 'Thêm sách' }))

    for (const msg of [
      'Vui lòng nhập tên sách',
      'Vui lòng nhập tác giả',
      'Vui lòng nhập năm xuất bản',
      'Vui lòng chọn thể loại',
      'Vui lòng nhập số lượng',
      'Vui lòng nhập mô tả',
    ]) {
      expect(await screen.findByText(msg)).toBeInTheDocument()
    }
    expect(createBook).not.toHaveBeenCalled()
  })

  it('F-01 EC-03/04/05/11: năm, ISBN, số lượng sai → lỗi', async () => {
    const user = userEvent.setup()
    await renderAddBook()

    await fillValid(user, { publishYear: '1899', isbn: '9780306406158', quantity: '1.5' })
    await user.click(screen.getByRole('button', { name: 'Thêm sách' }))

    expect(await screen.findByText('Năm xuất bản phải từ 1900')).toBeInTheDocument()
    expect(screen.getByText(/ISBN không hợp lệ/)).toBeInTheDocument()
    expect(screen.getByText('Số lượng phải là số nguyên')).toBeInTheDocument()
    expect(createBook).not.toHaveBeenCalled()
  })

  it('F-02 EC-13/BR-04: chưa có thể loại → thông báo + link, không render form', async () => {
    await renderAddBook([])
    expect(screen.getByRole('alert')).toHaveTextContent('Cần tạo thể loại trước')
    expect(screen.getByRole('link', { name: 'Đi tới trang Thể loại' })).toHaveAttribute('href', '/categories')
    expect(screen.queryByRole('button', { name: 'Thêm sách' })).not.toBeInTheDocument()
  })

  it('F-03 HC-01/HC-07: hợp lệ → gửi số, hiện "Thêm sách thành công", form trống lại', async () => {
    const user = userEvent.setup()
    await renderAddBook()
    createBook.mockResolvedValue({
      id: 'b1',
      title: 'Clean Code',
      totalQuantity: 5,
      category: { id: 3, name: 'Công nghệ thông tin' },
    })

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Thêm sách' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Thêm sách thành công')
    expect(screen.getByTestId('added-book')).toHaveTextContent('Clean Code')
    expect(createBook).toHaveBeenCalledWith({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publishYear: 2008,
      isbn: '978-0-13-235088-4',
      categoryId: 3,
      description: 'Sách về code sạch',
      quantity: 5,
    })
    expect(screen.getByLabelText('Tên sách')).toHaveValue('')
    expect(screen.getByLabelText('Thể loại')).toHaveValue('')
  })

  it('EC-06: ISBN trùng → lỗi server dưới ô ISBN', async () => {
    const user = userEvent.setup()
    await renderAddBook()
    createBook.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'ISBN_EXISTS', message: 'ISBN đã tồn tại ở sách khác' } } },
    })

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Thêm sách' }))

    expect(await screen.findByText('ISBN đã tồn tại ở sách khác')).toBeInTheDocument()
    expect(screen.getByLabelText('ISBN (không bắt buộc)')).toHaveAttribute('aria-invalid', 'true')
  })
})
