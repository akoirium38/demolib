import { expect, test } from '@playwright/test';

// 2.1.1 Đăng ký — E-xx ánh xạ HC/EC trong docs/flows/2.1.1-dang-ky.md
// User tạo ra dùng đuôi @test.demolib.local và được dọn sau khi chạy.

const fill = async (page, { email = '', name = '', password = '', confirmPassword = '' }) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Tên').fill(name);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Xác nhận mật khẩu').fill(confirmPassword);
};

const submit = (page) => page.getByRole('button', { name: 'Đăng ký' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/register');
});

test('E-01 HC-01/BR-04: đăng ký hợp lệ → chuyển tới Đăng nhập kèm thông báo', async ({ page }) => {
  await fill(page, {
    email: `e2e-${Date.now()}@test.demolib.local`,
    name: 'Người Dùng E2E',
    password: '12345678',
    confirmPassword: '12345678',
  });
  await submit(page);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toHaveText('Đăng ký thành công. Vui lòng đăng nhập.');
});

test('E-02 EC-11: submit form rỗng → lỗi dưới cả 4 trường, không gọi API', async ({ page }) => {
  let apiCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/auth/register')) apiCalls += 1;
  });

  await submit(page);

  await expect(page.getByText('Vui lòng nhập email')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập tên')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập mật khẩu')).toBeVisible();
  await expect(page.getByText('Vui lòng xác nhận mật khẩu')).toBeVisible();
  expect(apiCalls).toBe(0);
});

test('E-03 EC-01/04/05: email sai, tên 51 ký tự, mật khẩu 7 ký tự', async ({ page }) => {
  await fill(page, {
    email: 'a@',
    name: 'a'.repeat(51),
    password: '1234567',
    confirmPassword: '1234567',
  });
  await submit(page);

  await expect(page.getByText('Email không hợp lệ')).toBeVisible();
  await expect(page.getByText('Tên tối đa 50 ký tự')).toBeVisible();
  await expect(page.getByText('Mật khẩu tối thiểu 8 ký tự')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('E-04 EC-08: xác nhận mật khẩu không khớp', async ({ page }) => {
  await fill(page, {
    email: 'khongkhop@test.demolib.local',
    name: 'Không Khớp',
    password: '12345678',
    confirmPassword: '87654321',
  });
  await submit(page);

  await expect(page.getByText('Mật khẩu xác nhận không khớp')).toBeVisible();
  await expect(page.getByLabel('Xác nhận mật khẩu')).toHaveAttribute('aria-invalid', 'true');
});

test('E-05 EC-02: email đã tồn tại → báo lỗi từ server dưới trường Email', async ({ page }) => {
  await fill(page, {
    email: 'Reader1@DemoLib.local',
    name: 'Trùng Email',
    password: '12345678',
    confirmPassword: '12345678',
  });
  await submit(page);

  await expect(page.getByText('Email đã được sử dụng')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/register$/);
});
