import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { fetchMe } from '../api/auth'
import { fetchCategories } from '../api/categories'
import { fetchBooks } from '../api/books'
import { TOKEN_KEY } from '../api/client'

vi.mock('../api/auth', () => ({ registerUser: vi.fn(), loginUser: vi.fn(), fetchMe: vi.fn() }))
vi.mock('../api/categories', () => ({
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))
vi.mock('../api/books', () => ({ fetchBooks: vi.fn(), createBook: vi.fn() }))

const CATEGORIES = [
  { id: 3, name: 'Công nghệ thông tin', bookCount: 1 },
  { id: 5, name: 'Văn học', bookCount: 1 },
]
const BOOKS = [
  {
    id: 'b1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    publishYear: 2008,
    category: { id: 3, name: 'Công nghệ thông tin' },
    availableQuantity: 3,
    borrowedQuantity: 2,
    status: 'AVAILABLE',
  },
  {
    id: 'b2',
    title: 'Dế Mèn phiêu lưu ký',
    author: 'Tô Hoài',
    publishYear: 1941,
    category: { id: 5, name: 'Văn học' },
    availableQuantity: 0,
    borrowedQuantity: 4,
    status: 'OUT_OF_STOCK',
  },
]
const page = (data, meta = {}) => ({ data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1, ...meta } })

const renderAt = async (path = '/', user = null) => {
  if (user) {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    fetchMe.mockResolvedValue(user)
  }
  window.history.pushState({}, '', path)
  render(<App />)
  await screen.findByRole('heading', { name: 'Thư viện DemoLib' })
}

const lastQuery = () => fetchBooks.mock.calls.at(-1)[0]

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  fetchCategories.mockResolvedValue(CATEGORIES)
  fetchBooks.mockResolvedValue(page(BOOKS))
})

describe('2.2.3 Danh sách sách — BookListPage', () => {
  it('F-01 HC-01/HC-09: khách xem bảng sách với số lượng có sẵn, đang mượn, trạng thái', async () => {
    await renderAt('/')

    const rows = await screen.findAllByTestId('book-row')
    expect(rows).toHaveLength(2)
    const first = within(rows[0])
    expect(first.getByText('Clean Code')).toBeInTheDocument()
    expect(first.getByText('Robert C. Martin')).toBeInTheDocument()
    expect(first.getByText('2008')).toBeInTheDocument()
    expect(first.getByText('Công nghệ thông tin')).toBeInTheDocument()
    expect(first.getByText('3')).toBeInTheDocument()
    expect(first.getByText('2')).toBeInTheDocument()
    expect(first.getByText('Có sẵn')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Hết sách')).toBeInTheDocument()
    expect(lastQuery()).toEqual({ q: undefined, categoryId: undefined, sort: 'title', page: 1, limit: 10 })
    expect(screen.queryByRole('link', { name: 'Thêm Sách Mới' })).not.toBeInTheDocument()
  })

  it('F-02 HC-03/05/06/BR-05: tìm kiếm, lọc, sắp xếp, phân trang đồng bộ lên URL', async () => {
    const user = userEvent.setup()
    fetchBooks.mockResolvedValue(page(BOOKS, { total: 25, totalPages: 3 }))
    await renderAt('/')
    await screen.findAllByTestId('book-row')

    await user.type(screen.getByLabelText('Tìm kiếm'), '  martin ')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(lastQuery()).toMatchObject({ q: 'martin', page: 1 })
    expect(window.location.search).toBe('?q=martin')

    await user.selectOptions(screen.getByLabelText('Thể loại'), '3')
    await user.selectOptions(screen.getByLabelText('Sắp xếp'), 'newest')
    expect(lastQuery()).toMatchObject({ q: 'martin', categoryId: 3, sort: 'newest', page: 1 })

    await user.click(await screen.findByRole('button', { name: 'Trang sau' }))
    expect(lastQuery()).toMatchObject({ categoryId: 3, page: 2 })
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2')
    expect(await screen.findByText(/Trang 2\/3/)).toBeInTheDocument()

    // Đổi bộ lọc → quay về trang 1
    await user.selectOptions(screen.getByLabelText('Sắp xếp'), 'popular')
    expect(lastQuery()).toMatchObject({ sort: 'popular', page: 1 })
  })

  it('F-02 BR-05: mở link có sẵn query → nạp đúng bộ lọc', async () => {
    await renderAt('/?q=code&categoryId=5&sort=popular&page=2')
    expect(lastQuery()).toEqual({ q: 'code', categoryId: 5, sort: 'popular', page: 2, limit: 10 })
    expect(screen.getByLabelText('Tìm kiếm')).toHaveValue('code')
    expect(await screen.findByRole('option', { name: 'Văn học', selected: true })).toBeInTheDocument()
  })

  it('F-02 BR-05: tham số sai trên URL bị bỏ qua, không gọi API với giá trị sai', async () => {
    await renderAt('/?page=abc&sort=xyz&categoryId=-1')
    expect(lastQuery()).toEqual({ q: undefined, categoryId: undefined, sort: 'title', page: 1, limit: 10 })
  })

  it('F-02 EC-02: không có kết quả → "Không tìm thấy sách"', async () => {
    fetchBooks.mockResolvedValue(page([], { total: 0, totalPages: 0 }))
    await renderAt('/?q=khongcosachnay')
    expect(await screen.findByText('Không tìm thấy sách')).toBeInTheDocument()
    expect(screen.queryByTestId('book-row')).not.toBeInTheDocument()
  })

  it('F-02: lỗi API → thông báo lỗi', async () => {
    fetchBooks.mockRejectedValue({ response: { status: 500, data: { error: { message: 'Lỗi máy chủ' } } } })
    await renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ')
  })

  it('F-03: Staff thấy nút "Thêm Sách Mới" → /books/new; header không còn link "Thêm sách"', async () => {
    const user = userEvent.setup()
    await renderAt('/', { id: '1', email: 'lib@demolib.local', name: 'Thủ Thư', role: 'LIBRARIAN' })

    expect(screen.queryByRole('link', { name: 'Thêm sách' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('link', { name: 'Thêm Sách Mới' }))
    expect(await screen.findByRole('heading', { name: 'Thêm sách mới' })).toBeInTheDocument()
  })

  it('F-03: Reader không thấy nút "Thêm Sách Mới"', async () => {
    await renderAt('/', { id: '2', email: 'r@demolib.local', name: 'Độc Giả', role: 'READER' })
    expect(await screen.findByTestId('current-user')).toBeInTheDocument()
    await screen.findAllByTestId('book-row')
    expect(screen.queryByRole('link', { name: 'Thêm Sách Mới' })).not.toBeInTheDocument()
  })
})
