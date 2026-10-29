import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { fetchMe } from '../api/auth'
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '../api/categories'
import { TOKEN_KEY } from '../api/client'

vi.mock('../api/auth', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  fetchMe: vi.fn(),
}))

vi.mock('../api/categories', () => ({
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const LIBRARIAN = { id: '1', email: 'lib@demolib.local', name: 'Thủ Thư', role: 'LIBRARIAN' }
const CATEGORIES = [
  { id: 1, name: 'Khoa học', bookCount: 0 },
  { id: 2, name: 'Văn học', bookCount: 3 },
]

const apiError = (status, code, message) => ({ response: { status, data: { error: { code, message } } } })

const renderCategories = async () => {
  localStorage.setItem(TOKEN_KEY, 'jwt-token')
  fetchMe.mockResolvedValue(LIBRARIAN)
  fetchCategories.mockResolvedValue(CATEGORIES)
  window.history.pushState({}, '', '/categories')
  render(<App />)
  await screen.findByRole('heading', { name: 'Thể loại sách' })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('2.2.1 Thể loại — CategoriesPage', () => {
  it('HC-01: bảng hiển thị tên + số sách', async () => {
    await renderCategories()
    const rows = screen.getAllByTestId('category-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByText('Văn học')).toBeInTheDocument()
    expect(within(rows[1]).getByText('3')).toBeInTheDocument()
  })

  it('HC-02/EC-03: thêm mới → dòng mới; trùng tên → lỗi dưới ô nhập', async () => {
    const user = userEvent.setup()
    await renderCategories()
    createCategory.mockResolvedValueOnce({ id: 3, name: 'Lịch sử', bookCount: 0 })

    await user.type(screen.getByPlaceholderText('Tên thể loại mới'), '  Lịch sử ')
    await user.click(screen.getByRole('button', { name: 'Thêm thể loại sách' }))
    expect(await screen.findByRole('button', { name: 'Lịch sử' })).toBeInTheDocument()
    expect(createCategory).toHaveBeenCalledWith({ name: '  Lịch sử ' })
    expect(screen.getByPlaceholderText('Tên thể loại mới')).toHaveValue('')

    createCategory.mockRejectedValueOnce(apiError(409, 'CATEGORY_EXISTS', 'Tên thể loại đã tồn tại'))
    await user.type(screen.getByPlaceholderText('Tên thể loại mới'), 'KHOA HỌC')
    await user.click(screen.getByRole('button', { name: 'Thêm thể loại sách' }))
    expect(await screen.findByText('Tên thể loại đã tồn tại')).toBeInTheDocument()
  })

  it('EC-01: thêm tên rỗng → lỗi, không gọi API', async () => {
    const user = userEvent.setup()
    await renderCategories()
    await user.click(screen.getByRole('button', { name: 'Thêm thể loại sách' }))
    expect(await screen.findByText('Vui lòng nhập tên thể loại')).toBeInTheDocument()
    expect(createCategory).not.toHaveBeenCalled()
  })

  it('F-01 HC-04: sửa trên bảng + Enter → lưu tên mới', async () => {
    const user = userEvent.setup()
    await renderCategories()
    updateCategory.mockResolvedValue({ id: 1, name: 'Khoa học tự nhiên', bookCount: 0 })

    await user.click(screen.getByRole('button', { name: 'Khoa học' }))
    const input = screen.getByRole('textbox', { name: 'Sửa tên thể loại Khoa học' })
    await user.clear(input)
    await user.type(input, 'Khoa học tự nhiên{Enter}')

    expect(await screen.findByRole('button', { name: 'Khoa học tự nhiên' })).toBeInTheDocument()
    expect(updateCategory).toHaveBeenCalledTimes(1)
    expect(updateCategory).toHaveBeenCalledWith(1, { name: 'Khoa học tự nhiên' })
  })

  it('F-01 EC-04: lỗi khi lưu → khôi phục tên cũ + thông báo', async () => {
    const user = userEvent.setup()
    await renderCategories()
    updateCategory.mockRejectedValue(apiError(409, 'CATEGORY_EXISTS', 'Tên thể loại đã tồn tại'))

    await user.click(screen.getByRole('button', { name: 'Khoa học' }))
    const input = screen.getByRole('textbox', { name: 'Sửa tên thể loại Khoa học' })
    await user.clear(input)
    await user.type(input, 'Văn học{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Tên thể loại đã tồn tại')
    expect(screen.getByRole('button', { name: 'Khoa học' })).toBeInTheDocument()
  })

  it('F-01 BR-04: Esc hủy sửa, không gọi API', async () => {
    const user = userEvent.setup()
    await renderCategories()

    await user.click(screen.getByRole('button', { name: 'Khoa học' }))
    await user.type(screen.getByRole('textbox', { name: 'Sửa tên thể loại Khoa học' }), ' ABC{Escape}')

    expect(screen.getByRole('button', { name: 'Khoa học' })).toBeInTheDocument()
    expect(updateCategory).not.toHaveBeenCalled()
  })

  it('F-02 EC-07: modal xác nhận → "Hủy" không gọi API', async () => {
    const user = userEvent.setup()
    await renderCategories()

    await user.click(screen.getByRole('button', { name: 'Xóa Khoa học' }))
    const dialog = screen.getByRole('dialog', { name: 'Xóa thể loại' })
    expect(dialog).toHaveTextContent('Bạn có chắc muốn xóa thể loại Khoa học?')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteCategory).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('category-row')).toHaveLength(2)
  })

  it('HC-05/EC-06: "Đồng ý" → xóa dòng; còn sách → thông báo lỗi, dòng còn nguyên', async () => {
    const user = userEvent.setup()
    await renderCategories()
    deleteCategory.mockResolvedValueOnce({})

    await user.click(screen.getByRole('button', { name: 'Xóa Khoa học' }))
    await user.click(screen.getByRole('button', { name: 'Đồng ý' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã xóa thể loại "Khoa học"')
    expect(screen.getAllByTestId('category-row')).toHaveLength(1)

    deleteCategory.mockRejectedValueOnce(apiError(409, 'CATEGORY_HAS_BOOKS', 'Không thể xóa thể loại vẫn còn sách'))
    await user.click(screen.getByRole('button', { name: 'Xóa Văn học' }))
    await user.click(screen.getByRole('button', { name: 'Đồng ý' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xóa thể loại vẫn còn sách')
    expect(screen.getAllByTestId('category-row')).toHaveLength(1)
  })

  it('EC-09: Reader mở /categories → về trang chủ, không có link "Thể loại"', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token')
    fetchMe.mockResolvedValue({ ...LIBRARIAN, role: 'READER' })
    window.history.pushState({}, '', '/categories')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Thư viện DemoLib' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Thể loại' })).not.toBeInTheDocument()
    expect(fetchCategories).not.toHaveBeenCalled()
  })
})
