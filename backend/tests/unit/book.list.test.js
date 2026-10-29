import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET ??= 'unit-test-secret';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    books: { findMany: vi.fn(), count: vi.fn() },
  },
}));

const { prisma } = await import('../../src/lib/prisma.js');
const { listBooksQuerySchema } = await import('../../src/validators/book.validator.js');
const { listBooks } = await import('../../src/services/book.service.js');
const { createApp } = await import('../../src/app.js');

const CATEGORY = { id: 3, name: 'Công nghệ thông tin' };

const dbBook = (overrides = {}) => ({
  id: 'b0000000-0000-0000-0000-000000000001',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publish_year: 2008,
  isbn: '9780132350884',
  category_id: CATEGORY.id,
  description: 'Sách về viết code sạch',
  total_quantity: 5,
  available_quantity: 3,
  borrowed_quantity: 2,
  damaged_quantity: 0,
  lost_quantity: 0,
  borrow_count: 12,
  deleted_at: null,
  created_at: new Date('2026-10-29T00:00:00Z'),
  categories: CATEGORY,
  ...overrides,
});

const parse = (query) => listBooksQuerySchema.validate(query, { abortEarly: false, stripUnknown: true, convert: true });
const lastFindMany = () => prisma.books.findMany.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.books.findMany.mockResolvedValue([dbBook()]);
  prisma.books.count.mockResolvedValue(1);
});

describe('2.2.3 Danh sách sách — validator', () => {
  it('U-01 HC-01/HC-08: mặc định page=1, limit=10, sort=title, q rỗng', () => {
    const { value, error } = parse({});
    expect(error).toBeUndefined();
    expect(value).toEqual({ q: '', sort: 'title', page: 1, limit: 10 });
  });

  it('U-01: chuyển chuỗi query thành số, trim q, bỏ tham số lạ', () => {
    const { value } = parse({ q: '  martin ', categoryId: '3', sort: 'newest', page: '2', limit: '5', foo: 'x' });
    expect(value).toEqual({ q: 'martin', categoryId: 3, sort: 'newest', page: 2, limit: 5 });
  });

  it.each([
    ['page=0', { page: '0' }, 'page'],
    ['page=-1', { page: '-1' }, 'page'],
    ['page=abc', { page: 'abc' }, 'page'],
    ['page=1.5', { page: '1.5' }, 'page'],
    ['sort=abc', { sort: 'abc' }, 'sort'],
    ['limit=0', { limit: '0' }, 'limit'],
    ['limit=101', { limit: '101' }, 'limit'],
    ['categoryId=abc', { categoryId: 'abc' }, 'categoryId'],
    ['categoryId=0', { categoryId: '0' }, 'categoryId'],
    ['q 101 ký tự', { q: 'a'.repeat(101) }, 'q'],
  ])('U-02 EC-04/EC-05: %s → lỗi trường %s', (_, query, field) => {
    const { error } = parse(query);
    expect(error.details.map((d) => d.path.join('.'))).toContain(field);
  });
});

describe('2.2.3 Danh sách sách — service', () => {
  it('U-03 BR-01/EC-01: luôn lọc deleted_at = null, không q/categoryId thì không thêm điều kiện', async () => {
    await listBooks(parse({}).value);
    expect(lastFindMany().where).toEqual({ deleted_at: null });
    expect(prisma.books.count).toHaveBeenCalledWith({ where: { deleted_at: null } });
  });

  it('U-04 HC-03/HC-04/HC-05/HC-06: q tìm title HOẶC author (không phân biệt hoa thường) + categoryId', async () => {
    await listBooks(parse({ q: 'Martin', categoryId: '3' }).value);
    const pattern = { contains: 'Martin', mode: 'insensitive' };
    expect(lastFindMany().where).toEqual({
      deleted_at: null,
      category_id: 3,
      OR: [{ title: pattern }, { author: pattern }],
    });
    // count dùng cùng điều kiện với findMany
    expect(prisma.books.count.mock.calls[0][0].where).toEqual(lastFindMany().where);
  });

  it('U-05 EC-03: escape ký tự đại diện LIKE (%, _, \\); dấu nháy giữ nguyên', async () => {
    await listBooks(parse({ q: "100%_a\\b'" }).value);
    expect(lastFindMany().where.OR[0].title.contains).toBe("100\\%\\_a\\\\b'");
  });

  it.each([
    ['title', [{ title: 'asc' }, { id: 'asc' }]],
    ['newest', [{ publish_year: 'desc' }, { id: 'asc' }]],
    ['popular', [{ borrow_count: 'desc' }, { id: 'asc' }]],
  ])('U-06 HC-06/HC-07/HC-08/BR-03: sort=%s → orderBy có sắp xếp phụ theo id', async (sort, orderBy) => {
    await listBooks(parse({ sort }).value);
    expect(lastFindMany().orderBy).toEqual(orderBy);
  });

  it('U-07 HC-02: 25 sách, page=3 → skip 20, take 10, totalPages 3', async () => {
    prisma.books.count.mockResolvedValue(25);
    const result = await listBooks(parse({ page: '3' }).value);
    expect(lastFindMany()).toMatchObject({ skip: 20, take: 10 });
    expect(result.meta).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
  });

  it('U-08 EC-06/EC-07/EC-08: không có kết quả → data [], total 0, totalPages 0', async () => {
    prisma.books.findMany.mockResolvedValue([]);
    prisma.books.count.mockResolvedValue(0);
    const result = await listBooks(parse({ page: '9' }).value);
    expect(result).toEqual({ data: [], meta: { page: 9, limit: 10, total: 0, totalPages: 0 } });
  });
});

describe('2.2.3 Danh sách sách — GET /api/books', () => {
  it('U-09 HC-01/HC-09: khách không token → 200, data + meta, số lượng có sẵn/đang mượn đúng', async () => {
    const res = await request(createApp()).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(res.body.data[0]).toMatchObject({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publishYear: 2008,
      category: CATEGORY,
      availableQuantity: 3,
      borrowedQuantity: 2,
      borrowCount: 12,
      status: 'AVAILABLE',
    });
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });

  it('U-09: sách hết → status OUT_OF_STOCK', async () => {
    prisma.books.findMany.mockResolvedValue([dbBook({ available_quantity: 0, borrowed_quantity: 5 })]);
    const res = await request(createApp()).get('/api/books');
    expect(res.body.data[0].status).toBe('OUT_OF_STOCK');
  });

  it('U-10 EC-04/EC-05: query sai → 400 VALIDATION_ERROR, không truy vấn DB', async () => {
    const res = await request(createApp()).get('/api/books?page=0&sort=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['page', 'sort']);
    expect(prisma.books.findMany).not.toHaveBeenCalled();
  });

  it('U-10: q lặp lại (mảng) → 400', async () => {
    const res = await request(createApp()).get('/api/books?q=a&q=b');
    expect(res.status).toBe(400);
  });
});
