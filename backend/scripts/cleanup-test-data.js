// Xóa cứng dữ liệu do API test (Postman) và E2E test tạo ra. Không đụng tới dữ liệu seed.
// - Sách / thể loại có tên bắt đầu bằng "API " hoặc "E2E "
// - Tài khoản có email đuôi @test.demolib.local
// Chạy: cd backend && npm run db:cleanup-test (Playwright tự chạy sau E2E qua e2e/global-teardown.js)
import { prisma } from '../src/lib/prisma.js';

const TEST_PREFIXES = ['API ', 'E2E '];
const TEST_EMAIL_SUFFIX = '@test.demolib.local';

const startsWithAny = (field) => ({ OR: TEST_PREFIXES.map((p) => ({ [field]: { startsWith: p } })) });

async function main() {
  // Bỏ qua bản ghi đã có lịch sử mượn/phạt để không phá ràng buộc khóa ngoại
  const books = await prisma.books.deleteMany({ where: { ...startsWithAny('title'), loans: { none: {} } } });
  const categories = await prisma.categories.deleteMany({ where: { ...startsWithAny('name'), books: { none: {} } } });
  const users = await prisma.users.deleteMany({
    where: {
      email: { endsWith: TEST_EMAIL_SUFFIX },
      loans_loans_user_idTousers: { none: {} },
      fines_fines_user_idTousers: { none: {} },
    },
  });
  console.log(`Đã xóa dữ liệu test: ${books.count} sách, ${categories.count} thể loại, ${users.count} tài khoản`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
