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

// Prisma `contains` không escape ký tự đại diện của LIKE → tự escape để "%"/"_" được tìm đúng nghĩa đen (EC-03)
const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// BR-03: luôn sắp xếp phụ theo id để phân trang ổn định
const ORDER_BY = {
  title: [{ title: 'asc' }, { id: 'asc' }],
  newest: [{ publish_year: 'desc' }, { id: 'asc' }],
  popular: [{ borrow_count: 'desc' }, { id: 'asc' }],
};

// 2.2.3 — input đã qua listBooksQuerySchema (có giá trị mặc định)
export const listBooks = async ({ q, categoryId, sort, page, limit }) => {
  const where = { deleted_at: null };
  if (categoryId) where.category_id = categoryId;
  if (q) {
    const pattern = { contains: escapeLike(q), mode: 'insensitive' };
    where.OR = [{ title: pattern }, { author: pattern }];
  }

  const [books, total] = await Promise.all([
    prisma.books.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * limit,
      take: limit,
      include: includeCategory,
    }),
    prisma.books.count({ where }),
  ]);

  return {
    data: books.map(toBookDto),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
