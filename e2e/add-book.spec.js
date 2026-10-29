import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// 2.2.2 Thêm sách mới — E-xx ánh xạ HC/EC trong docs/flows/2.2.2-them-sach.md
// Sách tạo ra có tên bắt đầu bằng "E2E " và được xóa bởi e2e/global-teardown.js.
// EC-07 (ISBN trùng sách đã xóa mềm) chỉ có unit test cho tới khi có 3.8; EC-13 (chưa có thể loại) chỉ có FE unit test.
if (!process.env.SEED_PASSWORD) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../backend/.env', import.meta.url)));
  } catch {
    // CI: SEED_PASSWORD được cấp qua biến môi trường
  }
}

const PASSWORD = process.env.SEED_PASSWORD;

// ISBN-13 hợp lệ, khác nhau mỗi lần chạy: 979 + 9 chữ số + chữ số kiểm tra
const uniqueIsbn13 = () => {
  const base = `979${String(Date.now()).slice(-9)}`;
  const sum = [...base].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return base + ((10 - (sum % 10)) % 10);
};

const login = async (page, email) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
};

const openAddBookAsLibrarian = async (page) => {
  await login(page, 'librarian@demolib.local');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('link', { name: 'Thêm sách' }).click();
  await expect(page.getByRole('heading', { name: 'Thêm sách mới' })).toBeVisible();
};

const fillBook = async (page, book) => {
  await page.getByLabel('Tên sách').fill(book.title);
  await page.getByLabel('Tác giả').fill(book.author);
  await page.getByLabel('Năm xuất bản').fill(book.publishYear);
  await page.getByLabel('ISBN (không bắt buộc)').fill(book.isbn);
  await page.getByLabel('Thể loại').selectOption({ label: book.category });
  await page.getByLabel('Số lượng').fill(book.quantity);
  await page.getByLabel('Mô tả').fill(book.description);
};

const submit = (page) => page.getByRole('button', { name: 'Thêm sách', exact: true }).click();

const validBook = (overrides = {}) => ({
  title: `E2E ${Date.now()} Sách mới`,
  author: 'Tác Giả E2E',
  publishYear: '2020',
  isbn: '',
  category: 'Khoa học',
  quantity: '3',
  description: 'Sách tạo bởi E2E test',
  ...overrides,
});

test.beforeAll(() => {
  expect(PASSWORD, 'Thiếu SEED_PASSWORD (backend/.env)').toBeTruthy();
});

test('E-01 HC-01/HC-07: Librarian thêm sách hợp lệ → "Thêm sách thành công", form trống lại', async ({ page }) => {
  await openAddBookAsLibrarian(page);
  const book = validBook({ isbn: uniqueIsbn13() });

  await fillBook(page, book);
  await submit(page);

  await expect(page.getByRole('status')).toContainText('Thêm sách thành công');
  await expect(page.getByTestId('added-book')).toHaveText(`Đã thêm "${book.title}" — 3 cuốn, thể loại Khoa học`);
  await expect(page.getByLabel('Tên sách')).toHaveValue('');
});

test('E-02 EC-01…EC-11: form rỗng và giá trị sai → lỗi dưới từng trường, không gọi API', async ({ page }) => {
  await openAddBookAsLibrarian(page);
  let apiCalls = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/books')) apiCalls += 1;
  });

  await submit(page);
  for (const msg of [
    'Vui lòng nhập tên sách',
    'Vui lòng nhập tác giả',
    'Vui lòng nhập năm xuất bản',
    'Vui lòng chọn thể loại',
    'Vui lòng nhập số lượng',
    'Vui lòng nhập mô tả',
  ]) {
    await expect(page.getByText(msg)).toBeVisible();
  }

  await fillBook(
    page,
    validBook({
      title: 'a'.repeat(101),
      publishYear: String(new Date().getFullYear() + 1),
      isbn: '12345',
      quantity: '0',
      description: 'a'.repeat(256),
    }),
  );
  await submit(page);
  await expect(page.getByText('Tên sách tối đa 100 ký tự')).toBeVisible();
  await expect(page.getByText('Năm xuất bản không được lớn hơn năm hiện tại')).toBeVisible();
  await expect(page.getByText(/ISBN không hợp lệ/)).toBeVisible();
  await expect(page.getByText('Số lượng phải lớn hơn 0')).toBeVisible();
  await expect(page.getByText('Mô tả tối đa 255 ký tự')).toBeVisible();
  expect(apiCalls).toBe(0);
});

test('E-03 EC-06: ISBN trùng sách đang có → lỗi từ server dưới ô ISBN', async ({ page }) => {
  await openAddBookAsLibrarian(page);
  const isbn = uniqueIsbn13();

  await fillBook(page, validBook({ isbn }));
  await submit(page);
  await expect(page.getByRole('status')).toContainText('Thêm sách thành công');

  // Cùng ISBN, viết có dấu gạch → vẫn trùng sau khi chuẩn hóa
  const dashed = `${isbn.slice(0, 3)}-${isbn.slice(3, 12)}-${isbn.slice(12)}`;
  await fillBook(page, validBook({ title: `E2E ${Date.now()} Trùng ISBN`, isbn: dashed }));
  await submit(page);
  await expect(page.getByText('ISBN đã tồn tại ở sách khác')).toBeVisible();
  await expect(page.getByLabel('ISBN (không bắt buộc)')).toHaveAttribute('aria-invalid', 'true');
});

test('E-04 EC-12: Reader mở /books/new → về trang chủ, không có link "Thêm sách"', async ({ page }) => {
  await login(page, 'reader1@demolib.local');
  await expect(page.getByTestId('current-user')).toBeVisible();

  await page.goto('/books/new');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Thêm sách' })).toHaveCount(0);
});
