import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loginUser } from '../api/auth'
import { TOKEN_KEY } from '../api/client'

vi.mock('../api/auth', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  fetchMe: vi.fn(),
}))

const renderAt = (path) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

const fillAndSubmit = async (user, email, password) => {
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Mật khẩu'), password)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('2.1.2 Đăng nhập — LoginPage', () => {
  it('FU-01 EC-01/02: form rỗng / sai định dạng → lỗi từng trường, không gọi API', async () => {
    const user = userEvent.setup()
    renderAt('/login')

    await fillAndSubmit(user)
    expect(await screen.findByText('Vui lòng nhập email')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument()

    await fillAndSubmit(user, 'a@', '1234567')
    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument()
    expect(screen.getByText('Mật khẩu tối thiểu 8 ký tự')).toBeInTheDocument()
    expect(loginUser).not.toHaveBeenCalled()
  })

  it.each([
    ['READER', '/', 'Thư viện DemoLib'],
    ['LIBRARIAN', '/dashboard', 'Dashboard'],
    ['ADMIN', '/dashboard', 'Dashboard'],
  ])('FU-02 BR-04: %s đăng nhập → %s, lưu token', async (role, path, heading) => {
    loginUser.mockResolvedValue({
      token: 'jwt-token',
      expiresIn: 86400,
      user: { id: '1', email: 'a@b.com', name: 'Người Dùng', role },
    })
    const user = userEvent.setup()
    renderAt('/login')

    await fillAndSubmit(user, ' A@B.com ', '12345678')

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
    expect(loginUser).toHaveBeenCalledWith({ email: 'A@B.com', password: '12345678' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-token')
    expect(screen.getByTestId('current-user')).toHaveTextContent('Người Dùng')
  })

  it('FU-02 EC-03: lỗi INVALID_CREDENTIALS hiển thị chung, ở lại /login', async () => {
    loginUser.mockRejectedValue({
      response: {
        status: 401,
        data: { error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' } },
      },
    })
    const user = userEvent.setup()
    renderAt('/login')

    await fillAndSubmit(user, 'a@b.com', '12345678')

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng')
    expect(window.location.pathname).toBe('/login')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
