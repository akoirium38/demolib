import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// 2.2.1 Quản lý thể loại sách — E-xx ánh xạ HC/EC trong docs/flows/2.2.1-quan-ly-the-loai.md
// Thể loại tạo ra mang tiền tố "E2E <runId>" và được xóa qua API sau khi chạy.
// HC-06 (thể loại chỉ có sách đã xóa mềm) chỉ có unit test cho tới khi có 3.8.
if (!process.env.SEED_PASSWORD) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../backend/.env', import.meta.url)));
  } catch {
    // CI: SEED_PASSWORD được cấp qua biến môi trường
  }
}

const API = 'http://localhost:4000/api';
const PASSWORD = process.env.SEED_PASSWORD;
const PREFIX = `E2E ${Date.now()}`;

const login = async (page, email) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
};

const openCategoriesAsLibrarian = async (page) => {
  await login(page, 'librarian@demolib.local');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('link', { name: 'Thể loại' }).click();
  await expect(page.getByRole('heading', { name: 'Thể loại sách' })).toBeVisible();
};

const addCategory = async (page, name) => {
  await page.getByPlaceholder('Tên thể loại mới').fill(name);
  await page.getByRole('button', { name: 'Thêm thể loại sách' }).click();
};

const rowOf = (page, name) =>
  page.getByTestId('category-row').filter({ has: page.getByRole('button', { name, exact: true }) });

test.beforeAll(() => {
  expect(PASSWORD, 'Thiếu SEED_PASSWORD (backend/.env)').toBeTruthy();
});

test.afterAll(async ({ request }) => {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'librarian@demolib.local', password: PASSWORD },
  });
  const { token } = (await login.json()).data;
  const { data } = await (await request.get(`${API}/categories`)).json();
  for (const c of data.filter((x) => x.name.startsWith(PREFIX))) {
    await request.delete(`${API}/categories/${c.id}`, { headers: { Authorization: `Bearer ${token}` } });
  }
});

test('E-01 HC-01: Librarian mở "Thể loại" → bảng Tên / Số sách / Thao tác, có thể loại seed', async ({ page }) => {
  await openCategoriesAsLibrarian(page);

  for (const header of ['Tên thể loại', 'Số sách', 'Thao tác']) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
  const vanHoc = rowOf(page, 'Văn học');
  await expect(vanHoc).toHaveCount(1);
  await expect(vanHoc.getByRole('cell').nth(1)).not.toHaveText('0');
});

test('E-02 HC-02/EC-01/EC-03: thêm mới; tên rỗng và tên trùng báo lỗi', async ({ page }) => {
  await openCategoriesAsLibrarian(page);
  const name = `${PREFIX} Thêm`;

  await addCategory(page, '   ');
  await expect(page.getByText('Vui lòng nhập tên thể loại')).toBeVisible();

  await addCategory(page, name);
  await expect(page.getByRole('status')).toHaveText(`Đã thêm thể loại "${name}"`);
  await expect(rowOf(page, name)).toHaveCount(1);
  await expect(rowOf(page, name).getByRole('cell').nth(1)).toHaveText('0');

  await addCategory(page, name.toUpperCase());
  await expect(page.getByText('Tên thể loại đã tồn tại')).toBeVisible();
});

test('E-03 HC-04/EC-04: sửa trên bảng — Enter lưu, Esc hủy, trùng tên khôi phục tên cũ', async ({ page }) => {
  await openCategoriesAsLibrarian(page);
  const name = `${PREFIX} Sửa`;
  const renamed = `${PREFIX} Đã sửa`;
  await addCategory(page, name);
  await expect(rowOf(page, name)).toHaveCount(1);

  // Esc → hủy
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('textbox', { name: `Sửa tên thể loại ${name}` }).fill('Không lưu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();

  // Enter → lưu
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('textbox', { name: `Sửa tên thể loại ${name}` }).fill(renamed);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(`Đã đổi tên thành "${renamed}"`);
  await page.reload();
  await expect(rowOf(page, renamed)).toHaveCount(1);

  // Trùng tên thể loại seed → khôi phục + thông báo
  await page.getByRole('button', { name: renamed, exact: true }).click();
  await page.getByRole('textbox', { name: `Sửa tên thể loại ${renamed}` }).fill('văn học');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Tên thể loại đã tồn tại');
  await expect(rowOf(page, renamed)).toHaveCount(1);
});

test('E-04 EC-07/HC-05: modal xác nhận — "Hủy" giữ nguyên, "Đồng ý" xóa dòng', async ({ page }) => {
  await openCategoriesAsLibrarian(page);
  const name = `${PREFIX} Xóa`;
  await addCategory(page, name);
  await expect(rowOf(page, name)).toHaveCount(1);

  await page.getByRole('button', { name: `Xóa ${name}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa thể loại' });
  await expect(dialog).toContainText(`Bạn có chắc muốn xóa thể loại ${name}?`);
  await dialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rowOf(page, name)).toHaveCount(1);

  await page.getByRole('button', { name: `Xóa ${name}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý' }).click();
  await expect(page.getByRole('status')).toHaveText(`Đã xóa thể loại "${name}"`);
  await expect(rowOf(page, name)).toHaveCount(0);
  await page.reload();
  await expect(rowOf(page, name)).toHaveCount(0);
});

test('E-05 EC-06: xóa "Văn học" (còn sách) → thông báo lỗi, dòng vẫn còn', async ({ page }) => {
  await openCategoriesAsLibrarian(page);

  await page.getByRole('button', { name: 'Xóa Văn học' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý' }).click();

  await expect(page.getByRole('alert')).toHaveText('Không thể xóa thể loại vẫn còn sách');
  await expect(rowOf(page, 'Văn học')).toHaveCount(1);
});

test('E-06 EC-09: Reader mở /categories → về trang chủ, không có link "Thể loại"', async ({ page }) => {
  await login(page, 'reader1@demolib.local');
  await expect(page.getByTestId('current-user')).toBeVisible();

  await page.goto('/categories');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Thể loại' })).toHaveCount(0);
});
