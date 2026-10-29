import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ??= 'unit-test-secret';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    categories: { findUnique: vi.fn() },
    books: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

const { prisma } = await import('../../src/lib/prisma.js');
const { env } = await import('../../src/config/env.js');
const { createBookSchema, currentYear } = await import('../../src/validators/book.validator.js');
const { isValidIsbn, normalizeIsbn } = await import('../../src/utils/isbn.js');
const { createBook } = await import('../../src/services/book.service.js');
const { createApp } = await import('../../src/app.js');

const USER_ID = '00000000-0000-0000-0000-000000000001';
const CATEGORY = { id: 3, name: 'Công nghệ thông tin' };

const VALID = {
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publishYear: 2008,
  isbn: '9780132350884',
  categoryId: 3,
  description: 'Sách về viết code sạch',
  quantity: 5,
};

// Bản ghi DB giả lập từ data của prisma.books.create
const dbBook = (data) => ({
  id: 'b0000000-0000-0000-0000-000000000001',
  borrowed_quantity: 0,
  damaged_quantity: 0,
  lost_quantity: 0,
  borrow_count: 0,
  deleted_at: null,
  created_at: new Date('2026-10-29T00:00:00Z'),
  categories: CATEGORY,
  ...data,
});

const validate = (body) => createBookSchema.validate(body, { abortEarly: false, stripUnknown: true });
const fieldsWithError = (body) => {
  const { error } = validate(body);
  return error ? [...new Set(error.details.map((d) => d.path.join('.')))] : [];
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.users.findUnique.mockResolvedValue({ id: USER_ID, role: 'LIBRARIAN', is_active: true });
  prisma.categories.findUnique.mockResolvedValue({ id: CATEGORY.id });
  prisma.books.findFirst.mockResolvedValue(null);
  prisma.books.create.mockImplementation(async ({ data }) => dbBook(data));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('2.2.2 Thêm sách — ISBN', () => {
  it.each([
    ['ISBN-13', '9780306406157'],
    ['ISBN-13 (Clean Code)', '9780132350884'],
    ['ISBN-10', '0306406152'],
    ['ISBN-10 có X cuối', '080442957X'],
  ])('U-01 HC-01/03: %s hợp lệ', (_, isbn) => {
    expect(isValidIsbn(isbn)).toBe(true);
  });

  it('U-01 HC-04/BR-03: chuẩn hóa bỏ "-" và khoảng trắng, x cuối viết hoa', () => {
    expect(normalizeIsbn('978-0-306-40615-7')).toBe('9780306406157');
    expect(normalizeIsbn(' 0-8044-2957-x ')).toBe('080442957X');
    expect(validate({ ...VALID, isbn: '978-0-306-40615-7' }).value.isbn).toBe('9780306406157');
  });

  it.each([
    ['sai độ dài', '12345'],
    ['sai checksum ISBN-13', '9780306406158'],
    ['sai checksum ISBN-10', '0306406153'],
    ['X không ở cuối', '08044295X7'],
    ['chứa chữ', '978030640615A'],
  ])('U-02 EC-04/05: ISBN %s → lỗi isbn', (_, isbn) => {
    expect(fieldsWithError({ ...VALID, isbn })).toEqual(['isbn']);
  });

  it.each([
    ['không gửi', undefined],
    ['chuỗi rỗng', ''],
    ['chỉ khoảng trắng', '   '],
    ['null', null],
  ])('U-08 HC-02: ISBN %s → hợp lệ, không có ISBN', (_, isbn) => {
    const { error, value } = validate({ ...VALID, isbn });
    expect(error).toBeUndefined();
    expect(value.isbn ?? null).toBeNull();
  });
});

describe('2.2.2 Thêm sách — createBookSchema', () => {
  it('U-03 HC-05: năm 1900 và năm hiện tại (giờ VN) hợp lệ', () => {
    expect(fieldsWithError({ ...VALID, publishYear: 1900 })).toEqual([]);
    expect(fieldsWithError({ ...VALID, publishYear: currentYear() })).toEqual([]);
  });

  it.each([
    ['1899', 1899],
    ['năm sau', 'NEXT'],
    ['không phải số', 'abc'],
    ['số lẻ', 2000.5],
  ])('U-03 EC-03: năm %s → lỗi publishYear', (_, year) => {
    const publishYear = year === 'NEXT' ? currentYear() + 1 : year;
    expect(fieldsWithError({ ...VALID, publishYear })).toEqual(['publishYear']);
  });

  it('U-03: "năm hiện tại" theo giờ Việt Nam (31/12 17:30 UTC đã là năm mới ở VN)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T17:30:00Z'));
    expect(currentYear()).toBe(2027);
    expect(fieldsWithError({ ...VALID, publishYear: 2027 })).toEqual([]);
  });

  it.each([
    ['title', '', 'a'.repeat(101)],
    ['author', '   ', 'a'.repeat(101)],
    ['description', '', 'a'.repeat(256)],
  ])('U-04 EC-01/02/10: %s rỗng hoặc quá dài → lỗi', (field, empty, tooLong) => {
    expect(fieldsWithError({ ...VALID, [field]: empty })).toEqual([field]);
    expect(fieldsWithError({ ...VALID, [field]: tooLong })).toEqual([field]);
  });

  it('U-04: biên 100 / 100 / 255 ký tự hợp lệ, text được trim', () => {
    const body = { ...VALID, title: 'a'.repeat(100), author: 'b'.repeat(100), description: 'c'.repeat(255) };
    expect(fieldsWithError(body)).toEqual([]);
    expect(validate({ ...VALID, title: '  Clean Code ' }).value.title).toBe('Clean Code');
  });

  it('U-05 HC-06: số lượng 1 và 9999 hợp lệ', () => {
    expect(fieldsWithError({ ...VALID, quantity: 1 })).toEqual([]);
    expect(fieldsWithError({ ...VALID, quantity: 9999 })).toEqual([]);
  });

  it.each([0, -1, 1.5, 'abc', 10000, undefined])('U-05 EC-11: số lượng %s → lỗi quantity', (quantity) => {
    expect(fieldsWithError({ ...VALID, quantity })).toEqual(['quantity']);
  });

  it.each([undefined, '', 0, 'abc'])('U-06 EC-08: categoryId %s → lỗi categoryId', (categoryId) => {
    expect(fieldsWithError({ ...VALID, categoryId })).toEqual(['categoryId']);
  });
});

describe('2.2.2 Thêm sách — book.service.createBook', () => {
  it('U-08 HC-01/BR-01: lưu available = total = quantity, trả status AVAILABLE', async () => {
    const book = await createBook(VALID);
    expect(prisma.books.create).toHaveBeenCalledWith({
      data: {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        publish_year: 2008,
        isbn: '9780132350884',
        category_id: 3,
        description: 'Sách về viết code sạch',
        total_quantity: 5,
        available_quantity: 5,
      },
      include: { categories: { select: { id: true, name: true } } },
    });
    expect(book).toMatchObject({
      title: 'Clean Code',
      publishYear: 2008,
      category: CATEGORY,
      totalQuantity: 5,
      availableQuantity: 5,
      borrowedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      borrowCount: 0,
      status: 'AVAILABLE',
    });
  });

  it('U-08 HC-02: không có ISBN → lưu null, không kiểm tra trùng', async () => {
    const book = await createBook({ ...VALID, isbn: undefined });
    expect(book.isbn).toBeNull();
    expect(prisma.books.create.mock.calls[0][0].data.isbn).toBeNull();
    expect(prisma.books.findFirst).not.toHaveBeenCalled();
  });

  it('U-06 EC-09: thể loại không tồn tại → 400 CATEGORY_NOT_FOUND, không lưu', async () => {
    prisma.categories.findUnique.mockResolvedValue(null);
    await expect(createBook(VALID)).rejects.toMatchObject({
      status: 400,
      code: 'CATEGORY_NOT_FOUND',
      details: [{ field: 'categoryId', message: 'Thể loại không tồn tại' }],
    });
    expect(prisma.books.create).not.toHaveBeenCalled();
  });

  it('U-07 EC-06: ISBN trùng sách chưa xóa → 409 ISBN_EXISTS', async () => {
    prisma.books.findFirst.mockResolvedValue({ id: 'other' });
    await expect(createBook(VALID)).rejects.toMatchObject({ status: 409, code: 'ISBN_EXISTS' });
    expect(prisma.books.create).not.toHaveBeenCalled();
  });

  it('U-07 EC-07: chỉ tìm trùng trong sách chưa xóa mềm', async () => {
    await createBook(VALID);
    expect(prisma.books.findFirst).toHaveBeenCalledWith({
      where: { isbn: '9780132350884', deleted_at: null },
      select: { id: true },
    });
  });

  it('U-07: hai request song song → unique index (P2002) → 409', async () => {
    prisma.books.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(createBook(VALID)).rejects.toMatchObject({ code: 'ISBN_EXISTS' });
  });
});

describe('2.2.2 Thêm sách — POST /api/books', () => {
  const app = createApp();
  const tokenFor = (role) => jwt.sign({ role }, env.jwtSecret, { subject: USER_ID, expiresIn: '24h' });
  const post = (role) => {
    const req = request(app).post('/api/books');
    return role ? req.set('Authorization', `Bearer ${tokenFor(role)}`) : req;
  };

  it.each(['LIBRARIAN', 'ADMIN'])('U-08 (route): %s thêm sách → 201', async (role) => {
    prisma.users.findUnique.mockResolvedValue({ id: USER_ID, role, is_active: true });
    const res = await post(role).send({ ...VALID, isbn: '978-0-13-235088-4', publishYear: '2008', quantity: '5' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ isbn: '9780132350884', publishYear: 2008, totalQuantity: 5, status: 'AVAILABLE' });
  });

  it('U-04 (route): body rỗng → 400 với đủ 6 trường bắt buộc', async () => {
    const res = await post('LIBRARIAN').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(
      ['author', 'categoryId', 'description', 'publishYear', 'quantity', 'title'],
    );
  });

  it('U-06 (route): thể loại không tồn tại → 400 CATEGORY_NOT_FOUND kèm field', async () => {
    prisma.categories.findUnique.mockResolvedValue(null);
    const res = await post('LIBRARIAN').send({ ...VALID, categoryId: 999999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    expect(res.body.error.details).toEqual([{ field: 'categoryId', message: 'Thể loại không tồn tại' }]);
  });

  it('U-09 EC-12: Reader → 403', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: USER_ID, role: 'READER', is_active: true });
    const res = await post('READER').send(VALID);
    expect(res.status).toBe(403);
    expect(prisma.books.create).not.toHaveBeenCalled();
  });

  it('U-09: chưa đăng nhập → 401', async () => {
    const res = await post().send(VALID);
    expect(res.status).toBe(401);
  });
});
