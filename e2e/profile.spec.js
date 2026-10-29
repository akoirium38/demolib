import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// 2.1.3 Hồ sơ cá nhân — E-xx ánh xạ HC/EC trong docs/flows/2.1.3-ho-so-ca-nhan.md
// Mỗi test đăng ký một reader mới (@test.demolib.local) để không đụng tới tài khoản seed.
// HC-02/HC-03 (thống kê có đơn mượn, phiếu phạt) chỉ có unit test cho tới khi có 3.9/3.13.
if (!process.env.SEED_PASSWORD) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../backend/.env', import.meta.url)));
  } catch {
    // CI: SEED_PASSWORD được cấp qua biến môi trường
  }
}

const API = 'http://localhost:4000/api';
const PASSWORD = '12345678';
const NEW_PASSWORD = 'matkhaumoi1';

const login = async (page, email, password) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
};

// Đăng ký reader mới qua API rồi đăng nhập trên UI, mở trang Hồ sơ từ header
const newReaderOnProfile = async (page, request) => {
  const reader = {
    email: `e2e-profile-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.demolib.local`,
    name: 'Độc Giả Hồ Sơ',
  };
  const res = await request.post(`${API}/auth/register`, {
    data: { ...reader, password: PASSWORD, confirmPassword: PASSWORD },
  });
  expect(res.status()).toBe(201);

  await login(page, reader.email, PASSWORD);
  await expect(page.getByTestId('current-user')).toHaveText(reader.name);
  await page.getByRole('link', { name: 'Hồ sơ' }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ cá nhân' })).toBeVisible();
  return reader;
};

const fillPasswordForm = async (page, current, next, confirm = next) => {
  await page.getByLabel('Mật khẩu hiện tại').fill(current);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
  await page.getByLabel('Xác nhận mật khẩu mới').fill(confirm);
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
};

test('E-01 HC-01: reader mới — thông tin, "Chưa cập nhật", ngày tham gia, thống kê 0', async ({ page, request }) => {
  const reader = await newReaderOnProfile(page, request);

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId('profile-name')).toHaveText(reader.name);
  await expect(page.getByTestId('profile-email')).toHaveText(reader.email);
  await expect(page.getByTestId('profile-phone')).toHaveText('Chưa cập nhật');
  await expect(page.getByTestId('profile-address')).toHaveText('Chưa cập nhật');
  await expect(page.getByTestId('profile-joined')).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
  await expect(page.getByTestId('stat-borrow-count')).toHaveText('0');
  await expect(page.getByTestId('stat-total-fine')).toHaveText('0 đ');
  await expect(page.getByTestId('stat-unpaid-fine')).toHaveText('0 đ');
});

test('E-02 HC-04: cập nhật thông tin → thông báo, còn sau khi tải lại, header đổi tên', async ({ page, request }) => {
  await newReaderOnProfile(page, request);

  await page.getByLabel('Tên').fill('Tên Đã Sửa');
  await page.getByLabel('Số điện thoại').fill('+84912345678');
  await page.getByLabel('Địa chỉ').fill('12 Lê Lợi, Huế');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();

  await expect(page.getByRole('status')).toHaveText('Cập nhật thành công');
  await expect(page.getByTestId('current-user')).toHaveText('Tên Đã Sửa');

  await page.reload();
  await expect(page.getByTestId('profile-name')).toHaveText('Tên Đã Sửa');
  await expect(page.getByTestId('profile-phone')).toHaveText('+84912345678');
  await expect(page.getByTestId('profile-address')).toHaveText('12 Lê Lợi, Huế');
  await expect(page.getByTestId('current-user')).toHaveText('Tên Đã Sửa');
});

test('E-03 EC-02/03/04: dữ liệu sai → lỗi từng trường, không gọi API', async ({ page, request }) => {
  await newReaderOnProfile(page, request);
  let apiCalls = 0;
  page.on('request', (req) => {
    if (req.method() === 'PUT' && req.url().includes('/api/me/profile')) apiCalls += 1;
  });

  await page.getByLabel('Tên').fill('a'.repeat(51));
  await page.getByLabel('Số điện thoại').fill('0123456789');
  await page.getByLabel('Địa chỉ').fill('   ');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();

  await expect(page.getByText('Tên tối đa 50 ký tự')).toBeVisible();
  await expect(page.getByText('Số điện thoại không hợp lệ')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập địa chỉ')).toBeVisible();
  expect(apiCalls).toBe(0);
});

test('E-04 HC-06: đổi mật khẩu → đăng nhập bằng mật khẩu mới được, mật khẩu cũ bị từ chối', async ({ page, request }) => {
  const reader = await newReaderOnProfile(page, request);

  await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
  await expect(page.getByRole('status')).toHaveText('Đổi mật khẩu thành công');
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveValue('');

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await login(page, reader.email, PASSWORD);
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng');

  await login(page, reader.email, NEW_PASSWORD);
  await expect(page.getByTestId('current-user')).toHaveText(reader.name);
});

test('E-05 EC-06: sai mật khẩu hiện tại → lỗi dưới ô "Mật khẩu hiện tại"', async ({ page, request }) => {
  await newReaderOnProfile(page, request);

  await fillPasswordForm(page, 'sai-mat-khau', NEW_PASSWORD);

  await expect(page.getByText('Mật khẩu hiện tại không đúng')).toBeVisible();
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveAttribute('aria-invalid', 'true');
});

test('E-06 EC-01: chưa đăng nhập mở /profile → chuyển tới /login', async ({ page }) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});

test('E-07: Librarian xem hồ sơ — không có phần thống kê', async ({ page }) => {
  expect(process.env.SEED_PASSWORD, 'Thiếu SEED_PASSWORD (backend/.env)').toBeTruthy();
  await login(page, 'librarian@demolib.local', process.env.SEED_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Hồ sơ' }).click();
  await expect(page.getByTestId('profile-email')).toHaveText('librarian@demolib.local');
  await expect(page.getByTestId('profile-stats')).toHaveCount(0);
});
