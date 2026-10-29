import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// 2.1.2 Đăng nhập — E-xx ánh xạ HC/EC trong docs/flows/2.1.2-dang-nhap.md
// Dùng tài khoản seed; mật khẩu đọc từ SEED_PASSWORD trong backend/.env (hoặc biến môi trường CI).
if (!process.env.SEED_PASSWORD) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../backend/.env', import.meta.url)));
  } catch {
    // CI: SEED_PASSWORD được cấp qua biến môi trường
  }
}
const PASSWORD = process.env.SEED_PASSWORD;

const ACCOUNTS = {
  reader: { email: 'reader1@demolib.local', name: 'Nguyễn Văn An' },
  librarian: { email: 'librarian@demolib.local', name: 'Nhân viên thư viện' },
  admin: { email: 'admin@demolib.local', name: 'Quản lý viên' },
  disabled: { email: 'disabled@demolib.local' },
};

const fillAndSubmit = async (page, email, password) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
};

const loginAs = (page, account) => fillAndSubmit(page, ACCOUNTS[account].email, PASSWORD);

test.beforeAll(() => {
  expect(PASSWORD, 'Thiếu SEED_PASSWORD (backend/.env)').toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
});

test('E-01 HC-01: Reader đăng nhập → trang sách, header hiện tên', async ({ page }) => {
  await loginAs(page, 'reader');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('current-user')).toHaveText(ACCOUNTS.reader.name);
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
});

for (const account of ['librarian', 'admin']) {
  test(`E-02 HC-02/03: ${account} đăng nhập → /dashboard`, async ({ page }) => {
    await loginAs(page, account);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByTestId('current-user')).toHaveText(ACCOUNTS[account].name);
  });
}

test('E-03 EC-01/02: submit form rỗng → lỗi dưới 2 trường, không gọi API', async ({ page }) => {
  let apiCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/auth/login')) apiCalls += 1;
  });

  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Vui lòng nhập email')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập mật khẩu')).toBeVisible();
  expect(apiCalls).toBe(0);
});

test('E-04 EC-03/04: sai mật khẩu / email không tồn tại → cùng thông báo, ở lại /login', async ({ page }) => {
  await fillAndSubmit(page, ACCOUNTS.reader.email, 'sai-mat-khau-1');
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng');

  await fillAndSubmit(page, 'khongtontai@test.demolib.local', '12345678');
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng');

  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('demolib_token'))).toBeNull();
});

test('E-05 EC-05: tài khoản bị vô hiệu hóa → thông báo, không đăng nhập', async ({ page }) => {
  await loginAs(page, 'disabled');

  await expect(page.getByRole('alert')).toHaveText('Tài khoản đã bị vô hiệu hóa');
  await expect(page).toHaveURL(/\/login$/);
});

test('E-06 HC-05: tải lại trang sau khi đăng nhập → vẫn giữ phiên', async ({ page }) => {
  await loginAs(page, 'librarian');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByTestId('current-user')).toHaveText(ACCOUNTS.librarian.name);
});

test('E-07 HC-06: đăng xuất → xóa token, vào /dashboard bị chuyển về /login', async ({ page }) => {
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Đăng xuất' }).click();

  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('demolib_token'))).toBeNull();

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
});

test('E-08 EC-10: Reader mở /dashboard → chuyển về trang sách', async ({ page }) => {
  await loginAs(page, 'reader');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Thư viện DemoLib' })).toBeVisible();
});
