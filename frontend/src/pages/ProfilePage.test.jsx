import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { fetchMe } from '../api/auth'
import { changePassword, fetchProfile, updateProfile } from '../api/me'
import { TOKEN_KEY } from '../api/client'

vi.mock('../api/auth', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  fetchMe: vi.fn(),
}))

vi.mock('../api/me', () => ({
  fetchProfile: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
}))

const READER = {
  id: '1',
  email: 'reader@demolib.local',
  name: 'Độc Giả Mới',
  phone: null,
  address: null,
  role: 'READER',
  isActive: true,
  createdAt: '2026-10-29T03:00:00.000Z',
}

const renderProfile = async (user = READER) => {
  localStorage.setItem(TOKEN_KEY, 'jwt-token')
  fetchMe.mockResolvedValue(user)
  fetchProfile.mockResolvedValue({ ...user, stats: { borrowCount: 0, totalFine: 0, unpaidFine: 0 } })
  window.history.pushState({}, '', '/profile')
  render(<App />)
  await screen.findByRole('heading', { name: 'Hồ sơ cá nhân' })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('2.1.3 Hồ sơ — ProfilePage', () => {
  it('F-01 HC-01/BR-02: SĐT, địa chỉ trống → "Chưa cập nhật"; reader thấy thống kê 0', async () => {
    await renderProfile()

    expect(screen.getByTestId('profile-email')).toHaveTextContent(READER.email)
    expect(screen.getByTestId('profile-phone')).toHaveTextContent('Chưa cập nhật')
    expect(screen.getByTestId('profile-address')).toHaveTextContent('Chưa cập nhật')
    expect(screen.getByTestId('profile-joined')).toHaveTextContent('29/10/2026')
    expect(screen.getByTestId('stat-borrow-count')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-total-fine')).toHaveTextContent('0 đ')
  })

  it('F-01: Staff không thấy phần thống kê', async () => {
    await renderProfile({ ...READER, role: 'LIBRARIAN' })
    expect(screen.queryByTestId('profile-stats')).not.toBeInTheDocument()
  })

  it('F-02 EC-02/03/04: form thông tin lỗi → hiện lỗi từng trường, không gọi API', async () => {
    const user = userEvent.setup()
    await renderProfile()

    await user.clear(screen.getByLabelText('Tên'))
    await user.type(screen.getByLabelText('Số điện thoại'), '0123456789')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }))

    expect(await screen.findByText('Vui lòng nhập tên')).toBeInTheDocument()
    expect(screen.getByText('Số điện thoại không hợp lệ')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập địa chỉ')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('F-02 EC-07/08/09: form đổi mật khẩu lỗi → hiện lỗi, không gọi API', async () => {
    const user = userEvent.setup()
    await renderProfile()

    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), '12345678')
    await user.type(screen.getByLabelText('Mật khẩu mới'), '12345678')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'khac-nhau')
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))

    expect(await screen.findByText('Mật khẩu mới phải khác mật khẩu hiện tại')).toBeInTheDocument()
    expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('HC-04: cập nhật hợp lệ → thông báo thành công, header đổi tên', async () => {
    const user = userEvent.setup()
    await renderProfile()
    updateProfile.mockResolvedValue({ ...READER, name: 'Tên Mới', phone: '0912345678', address: 'Huế' })

    await user.clear(screen.getByLabelText('Tên'))
    await user.type(screen.getByLabelText('Tên'), 'Tên Mới')
    await user.type(screen.getByLabelText('Số điện thoại'), '0912345678')
    await user.type(screen.getByLabelText('Địa chỉ'), 'Huế')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Cập nhật thành công')
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Tên Mới', phone: '0912345678', address: 'Huế' })
    expect(screen.getByTestId('current-user')).toHaveTextContent('Tên Mới')
    expect(screen.getByTestId('profile-phone')).toHaveTextContent('0912345678')
  })

  it('EC-06: sai mật khẩu hiện tại → lỗi dưới ô "Mật khẩu hiện tại"', async () => {
    const user = userEvent.setup()
    await renderProfile()
    changePassword.mockRejectedValue({
      response: { status: 400, data: { error: { code: 'WRONG_PASSWORD', message: 'Mật khẩu hiện tại không đúng' } } },
    })

    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'sai-mat-khau')
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'matkhaumoi1')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'matkhaumoi1')
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))

    expect(await screen.findByText('Mật khẩu hiện tại không đúng')).toBeInTheDocument()
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveAttribute('aria-invalid', 'true')
  })
})
