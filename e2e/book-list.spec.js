import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// 2.2.3 Xem danh sách sách — E-xx ánh xạ HC/EC trong docs/flows/2.2.3-danh-sach-sach.md
// Dữ liệu: 12 sách "E2E <RUN> …" tạo qua API trong beforeAll, xóa bởi e2e/global-teardown.js.
// EC-01 (sách xóa mềm), EC-08 (DB rỗng), HC-07 (sort popular theo lượt mượn) chỉ có unit test cho tới khi có 3.8/3.9/3.13.
if (!process.env.SEED_PASSWORD) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../backend/.env', import.meta.url)));
  } catch {
    // CI: SEED_PASSWORD được cấp qua biến môi trường
  }
}

const PASSWORD = process.env.SEED_PASSWORD;
// Mã riêng mỗi lần chạy để tìm kiếm chỉ ra đúng sách của lần chạy này
const RUN = `R${Date.now().toString(36)}`;

const rows = (page) => page.getByTestId('book-row');

test.beforeAll(async ({ request }) => {
  expect(PASSWORD, 'Thiếu SEED_PASSWORD (backend/.env)').toBeTruthy();

  const login = await request.post('/api/auth/login', {
    data: { email: 'librarian@demolib.local', password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).data.token}` };

  const categories = (await (await request.get('/api/categories')).json()).data;
  const idOf = (name) => categories.find((c) => c.name === name).id;

  // 11 sách: 6 Khoa học (năm 2010…2015), 5 Văn học (năm 2001…2005) + 1 sách tên có "100%"
  const books = [
    ...Array.from({ length: 6 }, (_, i) => ({ n: i + 1, category: 'Khoa học', year: 2010 + i })),
    ...Array.from({ length: 5 }, (_, i) => ({ n: i + 7, category: 'Văn học', year: 2001 + i })),
  ].map(({ n, category, year }) => ({
    title: `E2E ${RUN} Sách ${String(n).padStart(2, '0')}`,
    category,
    year,
  }));
  books.push({ title: `E2E ${RUN} 100% sạch`, category: 'Khoa học', year: 2020 });

  for (const b of books) {
    const res = await request.post('/api/books', {
      headers,
      data: {
        title: b.title,
        author: `Tác Giả ${RUN}`,
        publishYear: b.year,
        categoryId: idOf(b.category),
        description: 'Sách tạo bởi E2E danh sách sách',
        quantity: 2,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
  }
});

const search = async (page, keyword) => {
  await page.getByLabel('Tìm kiếm').fill(keyword);
  await page.getByRole('button', { name: 'Tìm' }).click();
};

test('E-01 HC-01/HC-09: khách xem danh sách, tối đa 10 sách/trang, có số lượng và trạng thái', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Thư viện DemoLib' })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
  expect(await rows(page).count()).toBeLessThanOrEqual(10);
  await expect(page.getByRole('columnheader', { name: 'Có sẵn' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Đang mượn' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Thêm Sách Mới' })).toHaveCount(0);
});

test('E-02 HC-02/HC-03/HC-08/BR-05: tìm theo tác giả, phân trang, giữ trạng thái qua URL', async ({ page }) => {
  await page.goto('/');
  await search(page, `tác giả ${RUN.toLowerCase()}`);

  await expect(page).toHaveURL(new RegExp(`\\?q=`));
  await expect(page.getByText('12 sách · Trang 1/2')).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  // Mặc định sắp xếp tên A-Z: "100% sạch" đứng trước "Sách 01"
  await expect(rows(page).first()).toContainText(`E2E ${RUN} 100% sạch`);

  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).last()).toContainText(`E2E ${RUN} Sách 11`);
  await expect(page.getByRole('button', { name: 'Trang sau' })).toBeDisabled();

  // Mở lại link → giữ nguyên từ khóa và trang
  await page.reload();
  await expect(page.getByLabel('Tìm kiếm')).toHaveValue(`tác giả ${RUN.toLowerCase()}`);
  await expect(page.getByText('12 sách · Trang 2/2')).toBeVisible();
});

test('E-03 HC-05/HC-06: lọc thể loại + sắp xếp năm xuất bản mới nhất', async ({ page }) => {
  await page.goto('/');
  await search(page, RUN);
  await page.getByLabel('Thể loại').selectOption({ label: 'Văn học' });
  await page.getByLabel('Sắp xếp').selectOption({ label: 'Năm xuất bản mới nhất' });

  await expect(page.getByText('5 sách · Trang 1/1')).toBeVisible();
  await expect(rows(page)).toHaveCount(5);
  for (const row of await rows(page).all()) await expect(row).toContainText('Văn học');
  await expect(rows(page).first()).toContainText('2005');
  await expect(rows(page).last()).toContainText('2001');
});

test('E-04 EC-03: ký tự đặc biệt % và _ được tìm theo nghĩa đen', async ({ page }) => {
  await page.goto('/');
  await search(page, `${RUN} 100%`);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText(`E2E ${RUN} 100% sạch`);

  // "_" không được hiểu là "một ký tự bất kỳ"
  await search(page, `${RUN} S_ch`);
  await expect(page.getByText('Không tìm thấy sách')).toBeVisible();
});

test('E-05 EC-02: không có kết quả → "Không tìm thấy sách"', async ({ page }) => {
  await page.goto('/');
  await search(page, `${RUN} không tồn tại`);
  await expect(page.getByText('Không tìm thấy sách')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test('E-06: Librarian thấy nút "Thêm Sách Mới" → trang thêm sách', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('librarian@demolib.local');
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'DemoLib', exact: true }).click();
  await page.getByRole('link', { name: 'Thêm Sách Mới' }).click();
  await expect(page).toHaveURL(/\/books\/new$/);
  await expect(page.getByRole('heading', { name: 'Thêm sách mới' })).toBeVisible();
});
