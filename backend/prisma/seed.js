// Seed dữ liệu mẫu (docs/db-design.md §8). Chạy lại nhiều lần an toàn (idempotent).
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const password = process.env.SEED_PASSWORD;
if (!password) throw new Error('Thiếu SEED_PASSWORD trong .env');

const users = [
  { email: 'admin@demolib.local', name: 'Quản lý viên', role: 'ADMIN' },
  { email: 'librarian@demolib.local', name: 'Nhân viên thư viện', role: 'LIBRARIAN' },
  { email: 'reader1@demolib.local', name: 'Nguyễn Văn An', role: 'READER', phone: '0901234567', address: 'Hà Nội' },
  { email: 'reader2@demolib.local', name: 'Trần Thị Bình', role: 'READER', phone: '0912345678', address: 'TP. Hồ Chí Minh' },
  // Tài khoản bị vô hiệu hóa — test 2.1.2 EC-05
  { email: 'disabled@demolib.local', name: 'Tài khoản bị khóa', role: 'READER', is_active: false },
];

const categories = ['Văn học', 'Khoa học', 'Công nghệ thông tin', 'Lịch sử', 'Thiếu nhi'];

const fineLevels = [
  { name: 'Trả muộn', amount: 10000 },
  { name: 'Hư hỏng nhẹ', amount: 30000 },
  { name: 'Hư hỏng nặng', amount: 80000 },
  { name: 'Mất sách', amount: 150000 },
];

// [title, author, year, category, quantity]
const books = [
  ['Dế Mèn phiêu lưu ký', 'Tô Hoài', 1941, 'Thiếu nhi', 5],
  ['Truyện Kiều', 'Nguyễn Du', 1950, 'Văn học', 3],
  ['Số đỏ', 'Vũ Trọng Phụng', 1936, 'Văn học', 4],
  ['Tắt đèn', 'Ngô Tất Tố', 1939, 'Văn học', 2],
  ['Nhà giả kim', 'Paulo Coelho', 1988, 'Văn học', 6],
  ['Lược sử thời gian', 'Stephen Hawking', 1988, 'Khoa học', 3],
  ['Vũ trụ', 'Carl Sagan', 1980, 'Khoa học', 2],
  ['Gen: Lịch sử và tương lai', 'Siddhartha Mukherjee', 2016, 'Khoa học', 2],
  ['Clean Code', 'Robert C. Martin', 2008, 'Công nghệ thông tin', 4],
  ['The Pragmatic Programmer', 'Andrew Hunt, David Thomas', 1999, 'Công nghệ thông tin', 3],
  ['Cấu trúc dữ liệu và giải thuật', 'Đỗ Xuân Lôi', 2010, 'Công nghệ thông tin', 5],
  ['Đại Việt sử ký toàn thư', 'Ngô Sĩ Liên', 1993, 'Lịch sử', 2],
  ['Sapiens: Lược sử loài người', 'Yuval Noah Harari', 2011, 'Lịch sử', 4],
  ['Hoàng tử bé', 'Antoine de Saint-Exupéry', 1943, 'Thiếu nhi', 5],
  ['Kính vạn hoa', 'Nguyễn Nhật Ánh', 1995, 'Thiếu nhi', 1],
];

// ISBN-13 hợp lệ: tiền tố 978604 + số thứ tự 6 chữ số + chữ số kiểm tra
const isbn13 = (n) => {
  const base = `978604${String(n).padStart(6, '0')}`;
  const sum = [...base].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return base + ((10 - (sum % 10)) % 10);
};

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  for (const u of users) {
    await prisma.users.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password_hash: passwordHash },
    });
  }

  // skipDuplicates → ON CONFLICT DO NOTHING, áp dụng cả với unique index lower(name)
  await prisma.categories.createMany({
    data: categories.map((name) => ({ name })),
    skipDuplicates: true,
  });
  await prisma.fine_levels.createMany({ data: fineLevels, skipDuplicates: true });

  const categoryIds = Object.fromEntries(
    (await prisma.categories.findMany()).map((c) => [c.name, c.id]),
  );
  await prisma.books.createMany({
    data: books.map(([title, author, publish_year, category, qty], i) => ({
      title,
      author,
      publish_year,
      isbn: isbn13(i + 1),
      category_id: categoryIds[category],
      description: `${title} — ${author}`,
      total_quantity: qty,
      available_quantity: qty,
    })),
    skipDuplicates: true,
  });

  const counts = await Promise.all([
    prisma.users.count(),
    prisma.categories.count(),
    prisma.fine_levels.count(),
    prisma.books.count(),
  ]);
  console.log('users/categories/fine_levels/books =', counts.join('/'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
