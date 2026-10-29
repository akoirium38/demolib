import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ??= 'unit-test-secret';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    categories: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import('../../src/lib/prisma.js');
const { env } = await import('../../src/config/env.js');
const { categoryBodySchema } = await import('../../src/validators/category.validator.js');
const { listCategories, createCategory, updateCategory, deleteCategory } = await import(
  '../../src/services/category.service.js'
);
const { createApp } = await import('../../src/app.js');

const USER_ID = '00000000-0000-0000-0000-000000000001';
const makeUser = (role) => ({ id: USER_ID, email: 'u@demolib.local', name: 'U', role, is_active: true });
const row = (id, name, books = 0) => ({ id, name, _count: { books } });
const prismaError = (code, message = code) => Object.assign(new Error(message), { code });

const fieldsWithError = (body) => {
  const { error } = categoryBodySchema.validate(body, { abortEarly: false, stripUnknown: true });
  return error ? [...new Set(error.details.map((d) => d.path.join('.')))] : [];
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.users.findUnique.mockResolvedValue(makeUser('LIBRARIAN'));
  prisma.categories.findMany.mockResolvedValue([]);
  prisma.categories.findFirst.mockResolvedValue(null);
  prisma.categories.findUnique.mockResolvedValue(row(1, 'Khoa học'));
  prisma.categories.create.mockImplementation(async ({ data }) => row(10, data.name));
  prisma.categories.update.mockImplementation(async ({ where, data }) => row(where.id, data.name, 2));
  prisma.categories.delete.mockResolvedValue(row(1, 'Khoa học'));
});

describe('2.2.1 Thể loại — categoryBodySchema', () => {
  it('U-01 HC-02/03: tên hợp lệ được trim; đúng 50 ký tự hợp lệ', () => {
    expect(categoryBodySchema.validate({ name: '  Khoa học ' }).value).toEqual({ name: 'Khoa học' });
    expect(fieldsWithError({ name: 'a'.repeat(50) })).toEqual([]);
  });

  it.each([
    ['rỗng', ''],
    ['chỉ khoảng trắng', '   '],
    ['thiếu', undefined],
    ['51 ký tự', 'a'.repeat(51)],
  ])('U-02 EC-01/02: tên %s → lỗi name', (_, name) => {
    expect(fieldsWithError({ name })).toEqual(['name']);
  });
});

describe('2.2.1 Thể loại — category.service', () => {
  it('U-03 HC-01: danh sách sắp xếp theo tên, bookCount chỉ đếm sách chưa xóa mềm', async () => {
    prisma.categories.findMany.mockResolvedValue([row(2, 'Khoa học', 3), row(1, 'Văn học', 0)]);
    expect(await listCategories()).toEqual([
      { id: 2, name: 'Khoa học', bookCount: 3 },
      { id: 1, name: 'Văn học', bookCount: 0 },
    ]);
    const args = prisma.categories.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ name: 'asc' });
    expect(args.select._count).toEqual({ select: { books: { where: { deleted_at: null } } } });
  });

  it('U-04 HC-02: thêm mới → bookCount 0', async () => {
    expect(await createCategory({ name: 'Triết học' })).toEqual({ id: 10, name: 'Triết học', bookCount: 0 });
  });

  it('U-04 EC-03: trùng tên khác hoa thường → 409 CATEGORY_EXISTS, không tạo', async () => {
    prisma.categories.findFirst.mockResolvedValue({ id: 2 });
    await expect(createCategory({ name: 'KHOA HỌC' })).rejects.toMatchObject({
      status: 409,
      code: 'CATEGORY_EXISTS',
    });
    expect(prisma.categories.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'KHOA HỌC', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(prisma.categories.create).not.toHaveBeenCalled();
  });

  it('U-04 EC-03: hai request song song → unique constraint (P2002) → 409', async () => {
    prisma.categories.create.mockRejectedValue(prismaError('P2002'));
    await expect(createCategory({ name: 'Triết học' })).rejects.toMatchObject({ code: 'CATEGORY_EXISTS' });
  });

  it('U-05 HC-04/EC-05: sửa hợp lệ / giữ tên của chính nó → 200, loại trừ chính nó khi kiểm tra trùng', async () => {
    expect(await updateCategory(1, { name: 'khoa học' })).toEqual({ id: 1, name: 'khoa học', bookCount: 2 });
    expect(prisma.categories.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'khoa học', mode: 'insensitive' }, NOT: { id: 1 } },
      select: { id: true },
    });
  });

  it('U-05 EC-04: sửa thành tên thể loại khác → 409, không cập nhật', async () => {
    prisma.categories.findFirst.mockResolvedValue({ id: 2 });
    await expect(updateCategory(1, { name: 'Văn học' })).rejects.toMatchObject({ code: 'CATEGORY_EXISTS' });
    expect(prisma.categories.update).not.toHaveBeenCalled();
  });

  it('U-06 EC-08: sửa / xóa id không tồn tại → 404', async () => {
    prisma.categories.findUnique.mockResolvedValue(null);
    await expect(updateCategory(999, { name: 'X' })).rejects.toMatchObject({ status: 404 });
    await expect(deleteCategory(999)).rejects.toMatchObject({ status: 404 });
    expect(prisma.categories.update).not.toHaveBeenCalled();
    expect(prisma.categories.delete).not.toHaveBeenCalled();
  });

  it('U-07 HC-05/06: không còn sách chưa xóa (kể cả chỉ có sách đã xóa mềm) → xóa', async () => {
    prisma.categories.findUnique.mockResolvedValue(row(1, 'Khoa học', 0));
    await deleteCategory(1);
    expect(prisma.categories.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    // bookCount lấy theo deleted_at IS NULL → sách đã xóa mềm không chặn
    expect(prisma.categories.findUnique.mock.calls[0][0].select._count).toEqual({
      select: { books: { where: { deleted_at: null } } },
    });
  });

  it('U-08 EC-06: còn sách → 409 CATEGORY_HAS_BOOKS, không xóa', async () => {
    prisma.categories.findUnique.mockResolvedValue(row(1, 'Văn học', 4));
    await expect(deleteCategory(1)).rejects.toMatchObject({ status: 409, code: 'CATEGORY_HAS_BOOKS' });
    expect(prisma.categories.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['P2003', prismaError('P2003')],
    ['message của trigger', prismaError('P2010', 'Raw query failed: CATEGORY_HAS_BOOKS')],
  ])('U-08: trigger DB chặn xóa (%s) → 409 CATEGORY_HAS_BOOKS', async (_, err) => {
    prisma.categories.delete.mockRejectedValue(err);
    await expect(deleteCategory(1)).rejects.toMatchObject({ code: 'CATEGORY_HAS_BOOKS' });
  });
});

describe('2.2.1 Thể loại — routes /api/categories', () => {
  const app = createApp();
  const tokenFor = (role) => jwt.sign({ role }, env.jwtSecret, { subject: USER_ID, expiresIn: '24h' });
  const as = (role, req) => (role ? req.set('Authorization', `Bearer ${tokenFor(role)}`) : req);
  const useRole = (role) => prisma.users.findUnique.mockResolvedValue(makeUser(role));

  it('U-03 BR-05 (route): GET public, không cần token', async () => {
    prisma.categories.findMany.mockResolvedValue([row(1, 'Khoa học', 3)]);
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 1, name: 'Khoa học', bookCount: 3 }]);
  });

  it('U-04 (route): POST hợp lệ → 201', async () => {
    const res = await as('LIBRARIAN', request(app).post('/api/categories')).send({ name: ' Triết học ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: 10, name: 'Triết học', bookCount: 0 });
  });

  it('U-02 (route): POST tên rỗng → 400 field name', async () => {
    const res = await as('LIBRARIAN', request(app).post('/api/categories')).send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(['name']);
  });

  it('U-05 (route): PUT /:id → id được chuyển thành số', async () => {
    const res = await as('LIBRARIAN', request(app).put('/api/categories/7')).send({ name: 'Mới' });
    expect(res.status).toBe(200);
    expect(prisma.categories.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('U-06 (route): id "%s" không hợp lệ → 400', async (id) => {
    const res = await as('LIBRARIAN', request(app).delete(`/api/categories/${id}`));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(['id']);
    expect(prisma.categories.findUnique).not.toHaveBeenCalled();
  });

  it('U-06 (route): DELETE id không tồn tại → 404', async () => {
    prisma.categories.findUnique.mockResolvedValue(null);
    const res = await as('LIBRARIAN', request(app).delete('/api/categories/999'));
    expect(res.status).toBe(404);
  });

  it('U-07 (route): DELETE hợp lệ → 204 không có body', async () => {
    const res = await as('LIBRARIAN', request(app).delete('/api/categories/1'));
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('U-08 (route): DELETE còn sách → 409', async () => {
    prisma.categories.findUnique.mockResolvedValue(row(1, 'Văn học', 2));
    const res = await as('LIBRARIAN', request(app).delete('/api/categories/1'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_HAS_BOOKS');
  });

  it.each([
    ['post', '/api/categories'],
    ['put', '/api/categories/1'],
    ['delete', '/api/categories/1'],
  ])('U-09 EC-09: Reader %s %s → 403', async (method, path) => {
    useRole('READER');
    const res = await as('READER', request(app)[method](path)).send({ name: 'X' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('U-09 EC-10: khách POST → 401', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it.each(['LIBRARIAN', 'ADMIN'])('U-09 HC-07: %s thêm/sửa/xóa được', async (role) => {
    useRole(role);
    expect((await as(role, request(app).post('/api/categories')).send({ name: 'A' })).status).toBe(201);
    expect((await as(role, request(app).put('/api/categories/1')).send({ name: 'B' })).status).toBe(200);
    expect((await as(role, request(app).delete('/api/categories/1'))).status).toBe(204);
  });
});
