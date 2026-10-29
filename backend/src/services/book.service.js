import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { toBookDto } from '../utils/serializers.js';

const isbnExists = () => AppError.conflict('ISBN_EXISTS', 'ISBN đã tồn tại ở sách khác');

const includeCategory = { categories: { select: { id: true, name: true } } };

// 2.2.2 — input đã qua createBookSchema (text đã trim, ISBN đã chuẩn hóa hoặc null)
export const createBook = async ({ title, author, publishYear, isbn, categoryId, description, quantity }) => {
  const category = await prisma.categories.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) {
    throw new AppError(400, 'CATEGORY_NOT_FOUND', 'Thể loại không tồn tại', [
      { field: 'categoryId', message: 'Thể loại không tồn tại' },
    ]);
  }

  // ISBN chỉ cần duy nhất trong các sách chưa xóa mềm (EC-07)
  if (isbn) {
    const duplicate = await prisma.books.findFirst({ where: { isbn, deleted_at: null }, select: { id: true } });
    if (duplicate) throw isbnExists();
  }

  try {
    const book = await prisma.books.create({
      // BR-01: available = total = quantity, các bộ đếm khác mặc định 0
      data: {
        title,
        author,
        publish_year: publishYear,
        isbn: isbn ?? null,
        category_id: categoryId,
        description,
        total_quantity: quantity,
        available_quantity: quantity,
      },
      include: includeCategory,
    });
    return toBookDto(book);
  } catch (err) {
    // Hai request thêm cùng ISBN song song → partial unique index uq_books_isbn_active
    if (err?.code === 'P2002') throw isbnExists();
    throw err;
  }
};
